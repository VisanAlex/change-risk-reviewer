import {
  stableSerialize,
  type ChangedFile,
  type EvidenceEnvelopeV1,
  type EvidenceFact,
  type EvidenceSource,
  type JsonValue,
  type ReviewCandidate,
} from "./evidence.js";

const MAX_REVIEW_CANDIDATES = 5;
const MAX_FACTS_PER_CANDIDATE = 10;
const MAX_CHANGED_FILES = 100;
const MAX_TEST_PATHS_PER_FIELD = 50;
const MAX_WARNINGS = 20;
const MAX_SAMPLE_PATHS_PER_FACT = 8;

const FACT_PRECEDENCE: Partial<Record<EvidenceFact["reasonCode"], number>> = {
  FILE_ROLE: 10,
  TEXTUAL_REFERENCE_BREADTH: 20,
  IMPORT_REFERENCE_BREADTH: 30,
  CONTROL_FLOW_TOKEN: 40,
  PUBLIC_SURFACE_TOKEN: 50,
  HISTORY_CHANGE_FREQUENCY: 60,
  HISTORY_COCHANGE_BREADTH: 70,
  BINARY_CHANGE: 80,
  GENERATED_FILE: 90,
};

export interface ReviewInputFact {
  id: string;
  hunkId: string;
  reasonCode: EvidenceFact["reasonCode"];
  collector: string;
  sourceId: string;
  strength: "verified";
  value: unknown;
  limits?: Record<string, JsonValue>;
}

export interface ReviewInputSource extends EvidenceSource {
  id: string;
}

export interface ReviewInputV1 {
  kind: "change-risk-review-input";
  schemaVersion: "1";
  scope: EvidenceEnvelopeV1["scope"];
  repository: EvidenceEnvelopeV1["repository"];
  capabilities: EvidenceEnvelopeV1["capabilities"];
  changeSummary: {
    totalFiles: number;
    totalHunks: number;
    elevatedCandidates: number;
    notableCandidates: number;
    contextCandidates: number;
  };
  changedFiles: ChangedFile[];
  candidates: ReviewCandidate[];
  facts: ReviewInputFact[];
  sources: ReviewInputSource[];
  tests: EvidenceEnvelopeV1["tests"];
  warnings: string[];
  selection: {
    strategy: "ranked-reason-diversity";
    maxReviewCandidates: number;
    maxFactsPerCandidate: number;
    maxChangedFiles: number;
    totalCandidates: number;
    eligibleCandidates: number;
    selectedCandidates: number;
    omittedCandidates: number;
    omittedEligibleCandidates: number;
    excludedContextCandidates: number;
    totalFacts: number;
    selectedFacts: number;
    omittedFacts: number;
    totalChangedFiles: number;
    includedChangedFiles: number;
    omittedChangedFiles: number;
    totalWarnings: number;
    includedWarnings: number;
    omittedWarnings: number;
    totalChangedTests: number;
    includedChangedTests: number;
    omittedChangedTests: number;
    totalCandidateTests: number;
    includedCandidateTests: number;
    omittedCandidateTests: number;
    totalUnverifiedAreas: number;
    includedUnverifiedAreas: number;
    omittedUnverifiedAreas: number;
  };
  [key: string]: unknown;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compactFactValue(value: unknown): {
  value: unknown;
  samplePathsTruncated: boolean;
} {
  if (!isObject(value) || !Array.isArray(value.samplePaths)) {
    return { value, samplePathsTruncated: false };
  }
  return {
    value: {
      ...value,
      samplePaths: value.samplePaths.slice(0, MAX_SAMPLE_PATHS_PER_FACT),
    },
    samplePathsTruncated: value.samplePaths.length > MAX_SAMPLE_PATHS_PER_FACT,
  };
}

function fileRolesByHunk(envelope: EvidenceEnvelopeV1): Map<string, string[]> {
  const roles = new Map<string, string[]>();
  for (const fact of envelope.facts) {
    if (fact.reasonCode !== "FILE_ROLE" || !isObject(fact.value)) {
      continue;
    }
    const value = fact.value.roles;
    if (Array.isArray(value)) {
      roles.set(
        fact.hunkId,
        value.filter((role): role is string => typeof role === "string").sort(),
      );
    }
  }
  return roles;
}

function selectedCandidates(envelope: EvidenceEnvelopeV1): ReviewCandidate[] {
  const eligible = envelope.candidates.filter(({ band }) => band !== "context");
  const roles = fileRolesByHunk(envelope);
  const selectedIds = new Set<string>();
  const seenProfiles = new Set<string>();

  for (const candidate of eligible) {
    const profile = stableSerialize({
      band: candidate.band,
      reasons: [...candidate.reasons].sort(),
      roles: roles.get(candidate.hunkId) ?? [],
    });
    if (!seenProfiles.has(profile)) {
      seenProfiles.add(profile);
      selectedIds.add(candidate.hunkId);
      if (selectedIds.size === MAX_REVIEW_CANDIDATES) {
        break;
      }
    }
  }
  for (const candidate of eligible) {
    if (selectedIds.size === MAX_REVIEW_CANDIDATES) {
      break;
    }
    selectedIds.add(candidate.hunkId);
  }

  return eligible.filter(({ hunkId }) => selectedIds.has(hunkId));
}

function selectedFacts(
  envelope: EvidenceEnvelopeV1,
  candidates: readonly ReviewCandidate[],
): EvidenceFact[] {
  const factsByHunk = new Map<string, EvidenceFact[]>();
  for (const fact of envelope.facts) {
    const current = factsByHunk.get(fact.hunkId) ?? [];
    current.push(fact);
    factsByHunk.set(fact.hunkId, current);
  }

  return candidates.flatMap(({ hunkId }) =>
    (factsByHunk.get(hunkId) ?? [])
      .sort(
        (left, right) =>
          (FACT_PRECEDENCE[left.reasonCode] ?? 100) -
            (FACT_PRECEDENCE[right.reasonCode] ?? 100) ||
          left.id.localeCompare(right.id),
      )
      .slice(0, MAX_FACTS_PER_CANDIDATE)
  );
}

function compactFacts(facts: readonly EvidenceFact[]): {
  facts: ReviewInputFact[];
  sources: ReviewInputSource[];
} {
  const sourceIds = new Map<string, string>();
  const sources: ReviewInputSource[] = [];
  const compacted = facts.map((fact): ReviewInputFact => {
    const key = stableSerialize(fact.source);
    let sourceId = sourceIds.get(key);
    if (sourceId === undefined) {
      sourceId = `source-${sources.length + 1}`;
      sourceIds.set(key, sourceId);
      sources.push({ id: sourceId, ...fact.source });
    }
    const compactedValue = compactFactValue(fact.value);
    const base = {
      id: fact.id,
      hunkId: fact.hunkId,
      reasonCode: fact.reasonCode,
      collector: fact.collector,
      sourceId,
      strength: fact.strength,
      value: compactedValue.value,
    };
    const limits = compactedValue.samplePathsTruncated
      ? {
          ...(fact.limits ?? {}),
          reviewInputMaxSamplePaths: MAX_SAMPLE_PATHS_PER_FACT,
          reviewInputSamplePathsTruncated: true,
        }
      : fact.limits;
    return limits === undefined ? base : { ...base, limits };
  });
  return { facts: compacted, sources };
}

function compactChangedFiles(
  files: readonly ChangedFile[],
  candidates: readonly ReviewCandidate[],
): ChangedFile[] {
  const byPath = new Map(files.map((file) => [file.path, file]));
  const prioritizedPaths = [
    ...new Set([
      ...candidates.map(({ location }) => location.path),
      ...files.map(({ path }) => path).sort(),
    ]),
  ];
  return prioritizedPaths
    .flatMap((path) => {
      const file = byPath.get(path);
      return file === undefined ? [] : [file];
    })
    .slice(0, MAX_CHANGED_FILES);
}

function boundedTests(tests: EvidenceEnvelopeV1["tests"]): EvidenceEnvelopeV1["tests"] {
  return {
    changed: tests.changed.slice(0, MAX_TEST_PATHS_PER_FIELD),
    candidates: tests.candidates.slice(0, MAX_TEST_PATHS_PER_FIELD),
    unverifiedAreas: tests.unverifiedAreas.slice(0, MAX_TEST_PATHS_PER_FIELD),
  };
}

export function createReviewInput(envelope: EvidenceEnvelopeV1): ReviewInputV1 {
  const candidates = selectedCandidates(envelope);
  const eligibleCandidates = envelope.candidates.filter(({ band }) => band !== "context").length;
  const evidenceFacts = selectedFacts(envelope, candidates);
  const compacted = compactFacts(evidenceFacts);
  const changedFiles = compactChangedFiles(envelope.changedFiles, candidates);
  const tests = boundedTests(envelope.tests);
  const warnings = envelope.warnings.slice(0, MAX_WARNINGS);

  return assertReviewInputV1({
    kind: "change-risk-review-input",
    schemaVersion: "1",
    scope: envelope.scope,
    repository: envelope.repository,
    capabilities: envelope.capabilities,
    changeSummary: {
      totalFiles: envelope.changedFiles.length,
      totalHunks: envelope.candidates.length,
      elevatedCandidates: envelope.candidates.filter(({ band }) => band === "elevated").length,
      notableCandidates: envelope.candidates.filter(({ band }) => band === "notable").length,
      contextCandidates: envelope.candidates.filter(({ band }) => band === "context").length,
    },
    changedFiles,
    candidates,
    facts: compacted.facts,
    sources: compacted.sources,
    tests,
    warnings,
    selection: {
      strategy: "ranked-reason-diversity",
      maxReviewCandidates: MAX_REVIEW_CANDIDATES,
      maxFactsPerCandidate: MAX_FACTS_PER_CANDIDATE,
      maxChangedFiles: MAX_CHANGED_FILES,
      totalCandidates: envelope.candidates.length,
      eligibleCandidates,
      selectedCandidates: candidates.length,
      omittedCandidates: envelope.candidates.length - candidates.length,
      omittedEligibleCandidates: eligibleCandidates - candidates.length,
      excludedContextCandidates: envelope.candidates.length - eligibleCandidates,
      totalFacts: envelope.facts.length,
      selectedFacts: compacted.facts.length,
      omittedFacts: envelope.facts.length - compacted.facts.length,
      totalChangedFiles: envelope.changedFiles.length,
      includedChangedFiles: changedFiles.length,
      omittedChangedFiles: envelope.changedFiles.length - changedFiles.length,
      totalWarnings: envelope.warnings.length,
      includedWarnings: warnings.length,
      omittedWarnings: envelope.warnings.length - warnings.length,
      totalChangedTests: envelope.tests.changed.length,
      includedChangedTests: tests.changed.length,
      omittedChangedTests: envelope.tests.changed.length - tests.changed.length,
      totalCandidateTests: envelope.tests.candidates.length,
      includedCandidateTests: tests.candidates.length,
      omittedCandidateTests: envelope.tests.candidates.length - tests.candidates.length,
      totalUnverifiedAreas: envelope.tests.unverifiedAreas.length,
      includedUnverifiedAreas: tests.unverifiedAreas.length,
      omittedUnverifiedAreas:
        envelope.tests.unverifiedAreas.length - tests.unverifiedAreas.length,
    },
  });
}

export function assertReviewInputV1(value: unknown): ReviewInputV1 {
  if (
    !isObject(value) ||
    value.kind !== "change-risk-review-input" ||
    value.schemaVersion !== "1"
  ) {
    throw new Error("Review input must use kind change-risk-review-input and schemaVersion 1");
  }
  for (const field of [
    "capabilities",
    "changedFiles",
    "candidates",
    "facts",
    "sources",
    "warnings",
  ]) {
    if (!Array.isArray(value[field])) {
      throw new Error(`Review input ${field} must be an array`);
    }
  }
  if (!isObject(value.scope) || !isObject(value.repository) || !isObject(value.tests)) {
    throw new Error("Review input scope, repository, or test metadata is invalid");
  }
  if (!isObject(value.changeSummary) || !isObject(value.selection)) {
    throw new Error("Review input summary or selection metadata is missing");
  }

  const candidates = value.candidates as unknown[];
  const changedFiles = value.changedFiles as unknown[];
  const sources = value.sources as unknown[];
  const facts = value.facts as unknown[];
  if (candidates.length > MAX_REVIEW_CANDIDATES) {
    throw new Error("Review input exceeds the candidate limit");
  }
  if (
    candidates.some((candidate) =>
      isObject(candidate) && candidate.band === "context"
    )
  ) {
    throw new Error("Review input cannot contain a context candidate");
  }
  if (changedFiles.length > MAX_CHANGED_FILES) {
    throw new Error("Review input exceeds the changed-file limit");
  }
  if (facts.length > MAX_REVIEW_CANDIDATES * MAX_FACTS_PER_CANDIDATE) {
    throw new Error("Review input exceeds the evidence-fact limit");
  }
  const sourceIds = new Set(
    sources.flatMap((source) => {
      if (
        !isObject(source) ||
        typeof source.id !== "string" ||
        typeof source.tool !== "string" ||
        !Array.isArray(source.args)
      ) {
        throw new Error("Every review-input source must contain a reproducible command");
      }
      return [source.id];
    }),
  );
  for (const fact of facts) {
    if (!isObject(fact) || typeof fact.sourceId !== "string" || !sourceIds.has(fact.sourceId)) {
      throw new Error("Every review-input fact must reference a catalogued source");
    }
    if (fact.strength !== "verified") {
      throw new Error("Review-input facts must be marked verified");
    }
  }

  return value as unknown as ReviewInputV1;
}
