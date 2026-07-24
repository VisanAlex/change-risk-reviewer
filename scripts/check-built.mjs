import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";
import { buildSkillRuntime } from "./build-skill-runtime.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");
const committedPath = resolve(repositoryRoot, "skills/review/scripts/analyze.mjs");
const temporaryDirectory = await mkdtemp(join(tmpdir(), "change-risk-reviewer-build-"));
const temporaryPath = resolve(temporaryDirectory, "analyze.mjs");

try {
  await buildSkillRuntime(temporaryPath);
  const [expected, actual] = await Promise.all([
    readFile(committedPath),
    readFile(temporaryPath),
  ]);
  if (!expected.equals(actual)) {
    throw new Error("Bundled skill runtime is stale. Run npm run build:skill.");
  }
  process.stdout.write("Bundled skill runtime matches source.\n");
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
