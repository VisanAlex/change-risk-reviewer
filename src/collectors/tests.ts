import { basename, extname } from "node:path";
import type { CapabilityRecord, ChangedHunk } from "../contracts/evidence.js";
import { runGit } from "../git/process.js";

const TEST_PATH = /(^|\/)(tests?|spec|__tests__)(\/|$)|\.(test|spec)\.[^/]+$/u;

function stem(path: string): string {
  return basename(path, extname(path)).replace(/\.(test|spec)$/u, "");
}

export async function collectTestSignals(
  repository: string,
  hunks: readonly ChangedHunk[],
  snapshot?: string,
): Promise<{
  tests: { changed: string[]; candidates: string[]; unverifiedAreas: string[] };
  capability: CapabilityRecord;
}> {
  const listArgs = snapshot === undefined
    ? ["ls-files", "-co", "--exclude-standard", "-z"]
    : ["ls-tree", "-r", "--name-only", "-z", snapshot];
  const listed = await runGit(repository, listArgs);
  const repositoryTests = [...new Set(listed.stdout.split("\0").filter(Boolean).map((path) => path.replaceAll("\\", "/")))]
    .filter((path) => TEST_PATH.test(path))
    .sort();
  const changedPaths = [...new Set(hunks.map((hunk) => hunk.path))].sort();
  const changed = changedPaths.filter((path) => TEST_PATH.test(path));
  const changedSourceStems = new Set(changedPaths.filter((path) => !TEST_PATH.test(path)).map(stem));
  const candidates = repositoryTests.filter((path) => changedSourceStems.has(stem(path))).slice(0, 50);
  const testedStems = new Set([...changed, ...candidates].map(stem));
  const unverifiedAreas = changedPaths
    .filter((path) => !TEST_PATH.test(path) && !testedStems.has(stem(path)))
    .slice(0, 50);

  return {
    tests: { changed, candidates, unverifiedAreas },
    capability: {
      collector: "test-signals",
      status: "available",
      details: `Convention-based changed and nearby test paths from ${snapshot === undefined ? "the working tree" : "the selected head"}; no test-quality judgment.`,
      limits: {
        maxCandidateTests: 50,
        maxUnverifiedAreas: 50,
        snapshot: snapshot === undefined ? "working-tree" : "selected-head",
      },
    },
  };
}
