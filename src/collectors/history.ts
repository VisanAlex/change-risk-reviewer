import type { CapabilityRecord, ChangedHunk, EvidenceFact } from "../contracts/evidence.js";
import { runGit } from "../git/process.js";

const HISTORY_COMMITS = 100;

export async function collectHistoryFacts(
  repository: string,
  hunks: readonly ChangedHunk[],
): Promise<{ facts: EvidenceFact[]; capability: CapabilityRecord; warnings: string[] }> {
  const facts: EvidenceFact[] = [];
  try {
    for (const hunk of hunks) {
      const result = await runGit(
        repository,
        ["log", `--max-count=${HISTORY_COMMITS}`, "--format=__CRR_COMMIT__%H", "--name-only", "--", hunk.path],
        { timeoutMs: 4_000, maxOutputBytes: 512 * 1024 },
      );
      const commits = result.stdout.split(/\r?\n/u).filter((line) => line.startsWith("__CRR_COMMIT__"));
      const cochanged = new Set(
        result.stdout
          .split(/\r?\n/u)
          .filter((line) => line.length > 0 && !line.startsWith("__CRR_COMMIT__") && line !== hunk.path)
          .map((path) => path.replaceAll("\\", "/")),
      );
      const source = {
        tool: "git",
        args: ["log", `--max-count=${HISTORY_COMMITS}`, "--format=<commit>", "--name-only", "--", hunk.path],
        cwd: repository.replaceAll("\\", "/"),
      };
      facts.push({
        id: `${hunk.id}:history-frequency`,
        hunkId: hunk.id,
        reasonCode: "HISTORY_CHANGE_FREQUENCY",
        collector: "git-history",
        source,
        strength: "verified",
        value: { count: commits.length, window: HISTORY_COMMITS },
      });
      facts.push({
        id: `${hunk.id}:history-cochange`,
        hunkId: hunk.id,
        reasonCode: "HISTORY_COCHANGE_BREADTH",
        collector: "git-history",
        source,
        strength: "verified",
        value: { count: cochanged.size, samplePaths: [...cochanged].sort().slice(0, 20) },
      });
    }
  } catch (error) {
    return {
      facts,
      capability: {
        collector: "git-history",
        status: facts.length > 0 ? "partial" : "unavailable",
        details: `History collection stopped: ${error instanceof Error ? error.message : String(error)}`,
        limits: { maxCommitsPerPath: HISTORY_COMMITS },
      },
      warnings: ["Git history evidence is incomplete; completed facts were retained."],
    };
  }

  return {
    facts,
    capability: {
      collector: "git-history",
      status: "available",
      details: "Bounded per-path change frequency and cross-file co-change observations.",
      limits: { maxCommitsPerPath: HISTORY_COMMITS },
    },
    warnings: [],
  };
}
