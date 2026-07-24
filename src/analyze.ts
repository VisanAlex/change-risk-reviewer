import {
  assertEvidenceEnvelopeV1,
  type CapabilityRecord,
  type ChangedFile,
  type EvidenceEnvelopeV1,
  type EvidenceFact,
} from "./contracts/evidence.js";
import { collectFileSignalFacts } from "./collectors/file-signals.js";
import { collectHistoryFacts } from "./collectors/history.js";
import { collectReferenceFacts } from "./collectors/references.js";
import { collectTestSignals } from "./collectors/tests.js";
import { resolveRevisionRange, resolveWorkingChange } from "./git/scope.js";
import { rankCandidates } from "./ranking/rank.js";

export interface AnalyzeChangeOptions {
  repository: string;
  scope:
    | { kind: "working" }
    | {
        kind: "range";
        base: string;
        head: string;
      };
  collectorOptions?: {
    rgCommand?: string;
  };
}

function summarizeChangedFiles(hunks: EvidenceEnvelopeV1["candidates"] extends never ? never : Parameters<typeof collectFileSignalFacts>[0]): ChangedFile[] {
  const files = new Map<string, ChangedFile>();
  for (const hunk of hunks) {
    const current = files.get(hunk.path);
    if (current === undefined) {
      files.set(hunk.path, {
        path: hunk.path,
        editKind: hunk.editKind,
        binary: hunk.binary,
        hunkCount: 1,
      });
    } else {
      current.hunkCount += 1;
      current.binary ||= hunk.binary;
    }
  }
  return [...files.values()].sort((left, right) => left.path.localeCompare(right.path));
}

export async function analyzeChange(options: AnalyzeChangeOptions): Promise<EvidenceEnvelopeV1> {
  const resolved =
    options.scope.kind === "working"
      ? await resolveWorkingChange(options.repository)
      : await resolveRevisionRange(options.repository, options.scope.base, options.scope.head);
  const fileSignals = collectFileSignalFacts(resolved.hunks);
  const [references, history, testSignals] = await Promise.all([
    collectReferenceFacts(
      resolved.repositoryRoot,
      fileSignals.hunks,
      options.collectorOptions?.rgCommand,
    ),
    collectHistoryFacts(resolved.repositoryRoot, fileSignals.hunks),
    collectTestSignals(resolved.repositoryRoot, fileSignals.hunks),
  ]);
  const facts: EvidenceFact[] = [...fileSignals.facts, ...references.facts, ...history.facts].sort(
    (left, right) => left.hunkId.localeCompare(right.hunkId) || left.id.localeCompare(right.id),
  );
  const capabilities: CapabilityRecord[] = ([
    {
      collector: "git-scope",
      status: "available",
      details: "Git diff collected with external diff and text conversion disabled.",
      limits: { maxUntrackedFileBytes: 256 * 1024 },
    },
    {
      collector: "file-signals",
      status: "available",
      details: "Conservative path roles and changed-token patterns.",
      limits: {},
    },
    references.capability,
    history.capability,
    testSignals.capability,
    {
      collector: "language-intelligence",
      status: "unavailable",
      details: "No semantic dependency graph was supplied; downstream reach remains partial.",
      limits: {},
    },
  ] satisfies CapabilityRecord[]).sort((left, right) => left.collector.localeCompare(right.collector));
  const candidates = rankCandidates(fileSignals.hunks, facts, testSignals.tests.changed.length > 0);
  const warnings = [...resolved.warnings, ...references.warnings, ...history.warnings];
  if (fileSignals.hunks.length === 0) {
    warnings.push("No changed hunks were found in the selected scope.");
  }

  const envelope: EvidenceEnvelopeV1 = {
    schemaVersion: "1",
    scope: resolved.scope,
    repository: {
      root: resolved.repositoryRoot,
      headObject: resolved.headObject,
      dirty: resolved.dirty,
    },
    capabilities,
    changedFiles: summarizeChangedFiles(fileSignals.hunks),
    facts,
    candidates,
    tests: testSignals.tests,
    warnings: [...new Set(warnings)].sort(),
  };
  return assertEvidenceEnvelopeV1(envelope);
}
