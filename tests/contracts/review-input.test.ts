import { describe, expect, it } from "vitest";
import {
  stableSerialize,
  type EvidenceEnvelopeV1,
  type EvidenceFact,
  type PriorityBand,
  type ReviewCandidate,
} from "../../src/contracts/evidence.js";
import {
  assertReviewInputV1,
  createReviewInput,
} from "../../src/contracts/review-input.js";

const bands: PriorityBand[] = [
  "elevated",
  "elevated",
  "elevated",
  "notable",
  "notable",
  "notable",
  "context",
];

function candidate(index: number): ReviewCandidate {
  const path = `src/file-${String(index).padStart(3, "0")}.ts`;
  return {
    hunkId: `hunk-${index}`,
    location: {
      path,
      side: "current",
      start: index + 1,
      end: index + 1,
      deleted: false,
    },
    band: bands[index] ?? "context",
    reasons: index === 5 ? ["CONTROL_FLOW_CHANGE"] : ["PUBLIC_SURFACE_CHANGE"],
    tieBreak: {
      precedence: index,
      path,
      line: index + 1,
    },
  };
}

function factsFor(candidateValue: ReviewCandidate): EvidenceFact[] {
  return Array.from({ length: 12 }, (_, index) => ({
    id: `${candidateValue.hunkId}-fact-${String(index).padStart(2, "0")}`,
    hunkId: candidateValue.hunkId,
    reasonCode:
      index === 0
        ? "PUBLIC_SURFACE_TOKEN"
        : index === 1
          ? "TEXTUAL_REFERENCE_BREADTH"
          : "HISTORY_CHANGE_FREQUENCY",
    collector: index === 0 ? "file-signals" : "history",
    source: {
      tool: "git",
      args: ["log", "--format=%H", "--", candidateValue.location.path],
      cwd: "/repo",
    },
    strength: "verified",
    value: {
      count: index,
      samplePaths: Array.from({ length: 20 }, (_, sample) => `src/consumer-${sample}.ts`),
    },
  }));
}

function envelope(): EvidenceEnvelopeV1 {
  const candidates = bands.map((_, index) => candidate(index));
  return {
    schemaVersion: "1",
    scope: { kind: "working", headObject: "abc123" },
    repository: { root: "/repo", headObject: "abc123", dirty: true },
    capabilities: [],
    changedFiles: Array.from({ length: 110 }, (_, index) => ({
      path: `src/file-${String(index).padStart(3, "0")}.ts`,
      editKind: "modified",
      binary: false,
      hunkCount: 1,
    })),
    facts: candidates.flatMap(factsFor),
    candidates,
    tests: {
      changed: Array.from({ length: 60 }, (_, index) => `tests/changed-${index}.test.ts`),
      candidates: Array.from({ length: 60 }, (_, index) => `tests/candidate-${index}.test.ts`),
      unverifiedAreas: Array.from({ length: 60 }, (_, index) => `src/unverified-${index}.ts`),
    },
    warnings: [],
  };
}

describe("ReviewInputV1", () => {
  it("keeps only bounded, review-worthy evidence and deduplicates provenance", () => {
    const full = envelope();
    const input = createReviewInput(full);

    expect(input.kind).toBe("change-risk-review-input");
    expect(input.candidates).toHaveLength(5);
    expect(input.candidates.every(({ band }) => band !== "context")).toBe(true);
    expect(input.candidates.map(({ hunkId }) => hunkId)).toEqual([
      "hunk-0",
      "hunk-1",
      "hunk-2",
      "hunk-3",
      "hunk-5",
    ]);
    expect(input.facts).toHaveLength(50);
    expect(input.sources).toHaveLength(5);
    expect(input.changedFiles).toHaveLength(100);
    expect(input.selection).toMatchObject({
      totalCandidates: 7,
      strategy: "ranked-reason-diversity",
      selectedCandidates: 5,
      omittedCandidates: 2,
      totalFacts: 84,
      selectedFacts: 50,
      omittedFacts: 34,
      totalChangedFiles: 110,
      includedChangedFiles: 100,
      omittedChangedFiles: 10,
      totalChangedTests: 60,
      includedChangedTests: 50,
      omittedChangedTests: 10,
      totalCandidateTests: 60,
      includedCandidateTests: 50,
      omittedCandidateTests: 10,
      totalUnverifiedAreas: 60,
      includedUnverifiedAreas: 50,
      omittedUnverifiedAreas: 10,
    });
    expect(input.facts.every(({ sourceId }) =>
      input.sources.some(({ id }) => id === sourceId)
    )).toBe(true);
    const referenceFact = input.facts.find(
      ({ reasonCode }) => reasonCode === "TEXTUAL_REFERENCE_BREADTH",
    );
    expect(
      (referenceFact?.value as { samplePaths?: unknown[] }).samplePaths,
    ).toHaveLength(8);
    expect(referenceFact?.limits).toMatchObject({
      reviewInputMaxSamplePaths: 8,
      reviewInputSamplePathsTruncated: true,
    });
    expect(Buffer.byteLength(stableSerialize(input))).toBeLessThan(
      Buffer.byteLength(stableSerialize(full)) * 0.6,
    );
    expect(assertReviewInputV1(input)).toBe(input);
  });

  it("does not promote context-only candidates into the review queue", () => {
    const full = envelope();
    full.candidates = full.candidates.filter(({ band }) => band === "context");
    full.facts = full.facts.filter(({ hunkId }) =>
      full.candidates.some((candidateValue) => candidateValue.hunkId === hunkId)
    );

    const input = createReviewInput(full);

    expect(input.candidates).toEqual([]);
    expect(input.facts).toEqual([]);
    expect(input.sources).toEqual([]);
    expect(input.selection.selectedCandidates).toBe(0);
  });

  it("rejects context candidates in a compact review input", () => {
    const input = createReviewInput(envelope());
    input.candidates[input.candidates.length - 1] = candidate(6);

    expect(() => assertReviewInputV1(input)).toThrow(/context candidate/i);
  });
});
