import type { CapabilityRecord, ChangedHunk, EvidenceFact } from "../contracts/evidence.js";
import { runGit } from "../git/process.js";

const HISTORY_COMMITS = 100;
const MAX_HISTORY_PATHS = 100;
const MAX_GENERATED_HISTORY_PATHS = 5;

interface CommitPaths {
  commit: string;
  paths: Set<string>;
}

function selectedPaths(hunks: readonly ChangedHunk[]): {
  selected: string[];
  skipped: number;
} {
  const generatedByPath = new Map<string, boolean>();
  for (const hunk of hunks) {
    generatedByPath.set(hunk.path, (generatedByPath.get(hunk.path) ?? true) && hunk.generated);
  }
  const paths = [...generatedByPath].sort(([left], [right]) => left.localeCompare(right));
  const ordinary = paths
    .filter(([, generated]) => !generated)
    .map(([path]) => path)
    .slice(0, MAX_HISTORY_PATHS);
  const generated = paths
    .filter(([, isGenerated]) => isGenerated)
    .map(([path]) => path)
    .slice(0, MAX_GENERATED_HISTORY_PATHS);
  const selected = [...ordinary, ...generated];
  return { selected, skipped: paths.length - selected.length };
}

function parseCommitPaths(output: string): CommitPaths[] {
  const commits: CommitPaths[] = [];
  let current: CommitPaths | undefined;
  for (const token of output.split("\0").filter(Boolean)) {
    if (token.startsWith("__CRR_COMMIT__")) {
      current = { commit: token.slice("__CRR_COMMIT__".length), paths: new Set() };
      commits.push(current);
    } else if (current !== undefined) {
      current.paths.add(token.replace(/^\r?\n/u, "").replaceAll("\\", "/"));
    }
  }
  return commits;
}

export async function collectHistoryFacts(
  repository: string,
  hunks: readonly ChangedHunk[],
  revision: string,
): Promise<{ facts: EvidenceFact[]; capability: CapabilityRecord; warnings: string[] }> {
  const { selected, skipped } = selectedPaths(hunks);
  if (selected.length === 0) {
    return {
      facts: [],
      capability: {
        collector: "git-history",
        status: "available",
        details: "No changed paths required history collection.",
        limits: {
          maxCommits: HISTORY_COMMITS,
          maxPaths: MAX_HISTORY_PATHS,
          maxGeneratedPaths: MAX_GENERATED_HISTORY_PATHS,
          skippedPaths: 0,
          revision: "selected-head",
        },
      },
      warnings: [],
    };
  }

  try {
    const args = [
      "log",
      `--max-count=${HISTORY_COMMITS}`,
      "--format=__CRR_COMMIT__%H",
      "--name-only",
      "--full-diff",
      "-z",
      revision,
      "--",
      ...selected,
    ];
    const result = await runGit(repository, args, {
      timeoutMs: 6_000,
      maxOutputBytes: 2 * 1024 * 1024,
    });
    const commits = parseCommitPaths(result.stdout);
    const facts: EvidenceFact[] = [];
    const source = {
      tool: "git",
      args,
      cwd: repository.replaceAll("\\", "/"),
    };

    for (const hunk of hunks.filter((candidate) => selected.includes(candidate.path))) {
      const matchingCommits = commits.filter((commit) => commit.paths.has(hunk.path));
      const cochanged = new Set(
        matchingCommits.flatMap((commit) => [...commit.paths].filter((path) => path !== hunk.path)),
      );
      facts.push({
        id: `${hunk.id}:history-frequency`,
        hunkId: hunk.id,
        reasonCode: "HISTORY_CHANGE_FREQUENCY",
        collector: "git-history",
        source,
        strength: "verified",
        value: { count: matchingCommits.length, window: HISTORY_COMMITS },
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

    const partial = skipped > 0 || result.truncated;
    return {
      facts,
      capability: {
        collector: "git-history",
        status: partial ? "partial" : "available",
        details: "Bounded change frequency and cross-file co-change observations from one shared commit window.",
        limits: {
          maxCommits: HISTORY_COMMITS,
          maxPaths: MAX_HISTORY_PATHS,
          maxGeneratedPaths: MAX_GENERATED_HISTORY_PATHS,
          skippedPaths: skipped,
          revision: "selected-head",
          truncated: result.truncated,
        },
      },
      warnings: partial ? ["Git history evidence is incomplete; completed facts were retained."] : [],
    };
  } catch (error) {
    return {
      facts: [],
      capability: {
        collector: "git-history",
        status: "unavailable",
        details: `History collection failed: ${error instanceof Error ? error.message : String(error)}`,
        limits: {
          maxCommits: HISTORY_COMMITS,
          maxPaths: MAX_HISTORY_PATHS,
          maxGeneratedPaths: MAX_GENERATED_HISTORY_PATHS,
          skippedPaths: skipped,
          revision: "selected-head",
        },
      },
      warnings: ["Git history evidence is unavailable."],
    };
  }
}
