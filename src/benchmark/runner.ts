import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, posix, relative, resolve, sep, win32 } from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeChange } from "../analyze.js";
import {
  stableSerialize,
  type EvidenceEnvelopeV1,
  type ReasonCode,
  type SourceLocation,
} from "../contracts/evidence.js";
import { runGit } from "../git/process.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const caseRoot = resolve(repositoryRoot, "benchmarks/cases");
const oracleRoot = resolve(repositoryRoot, "benchmarks/oracles");
const CASE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

interface GeneratedGroup {
  count: number;
  pathTemplate: string;
  baseContentTemplate?: string;
  headContentTemplate?: string;
}

interface BenchmarkRecipe {
  id: string;
  description: string;
  baseFiles: Record<string, string>;
  headFiles: Record<string, string>;
  generatedGroups: GeneratedGroup[];
}

export interface OracleLocation {
  path: string;
  side: "current" | "old";
  start: number;
  end: number;
}

interface PositiveOracle {
  caseId: string;
  mode: "positive";
  expectedLocations: OracleLocation[];
  requiredAnyReasons: ReasonCode[];
}

interface NegativeOracle {
  caseId: string;
  mode: "negative";
  maximumElevated: number;
  maximumReviewTargets: number;
}

interface CapabilityOracle {
  caseId: string;
  mode: "capability";
  requiredUnavailableCollectors: string[];
  maximumElevated: number;
}

type BenchmarkOracle = PositiveOracle | NegativeOracle | CapabilityOracle;

export interface BenchmarkFixture {
  caseId: string;
  repository: string;
  capture: EvidenceEnvelopeV1;
  fingerprint: string;
  cleanup: () => Promise<void>;
}

export interface BenchmarkResult {
  caseId: string;
  passed: boolean;
  matchedRank: number | null;
  matchedReasons: ReasonCode[];
  capture: EvidenceEnvelopeV1;
  fingerprint: string;
  failures: string[];
}

function assertRecipe(value: unknown, expectedId: string): BenchmarkRecipe {
  if (typeof value !== "object" || value === null) {
    throw new Error(`Benchmark recipe ${expectedId} is not an object`);
  }
  const recipe = value as Partial<BenchmarkRecipe>;
  if (
    recipe.id !== expectedId ||
    typeof recipe.description !== "string" ||
    typeof recipe.baseFiles !== "object" ||
    recipe.baseFiles === null ||
    typeof recipe.headFiles !== "object" ||
    recipe.headFiles === null ||
    !Array.isArray(recipe.generatedGroups)
  ) {
    throw new Error(`Benchmark recipe ${expectedId} has an invalid shape`);
  }
  return recipe as BenchmarkRecipe;
}

function assertOracle(value: unknown, expectedId: string): BenchmarkOracle {
  if (typeof value !== "object" || value === null) {
    throw new Error(`Benchmark oracle ${expectedId} is not an object`);
  }
  const oracle = value as Partial<BenchmarkOracle>;
  if (oracle.caseId !== expectedId || !["positive", "negative", "capability"].includes(String(oracle.mode))) {
    throw new Error(`Benchmark oracle ${expectedId} has an invalid shape`);
  }
  return oracle as BenchmarkOracle;
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

async function readRecipe(caseId: string): Promise<BenchmarkRecipe> {
  if (!CASE_ID.test(caseId)) {
    throw new Error(`Invalid benchmark case ID: ${caseId}`);
  }
  return assertRecipe(await readJson(resolve(caseRoot, caseId, "case.json")), caseId);
}

function applyTemplate(template: string, index: number): string {
  return template.replaceAll("{index}", String(index));
}

export function resolveFixturePath(repository: string, path: string): string {
  const normalizedPath = path.replaceAll("\\", "/");
  if (
    path.length === 0 ||
    posix.isAbsolute(normalizedPath) ||
    win32.isAbsolute(path) ||
    /[\0\r\n]/u.test(path)
  ) {
    throw new Error(`Benchmark fixture path must be a relative single-line path: ${JSON.stringify(path)}`);
  }
  const target = resolve(repository, ...normalizedPath.split("/"));
  const pathFromRepository = relative(resolve(repository), target);
  if (
    pathFromRepository.length === 0 ||
    pathFromRepository === ".." ||
    pathFromRepository.startsWith(`..${sep}`) ||
    isAbsolute(pathFromRepository)
  ) {
    throw new Error(`Benchmark fixture path leaves the benchmark repository: ${JSON.stringify(path)}`);
  }
  return target;
}

async function writeFiles(repository: string, files: Record<string, string>): Promise<void> {
  for (const [path, content] of Object.entries(files).sort(([left], [right]) => left.localeCompare(right))) {
    const target = resolveFixturePath(repository, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
  }
}

async function writeGenerated(
  repository: string,
  groups: readonly GeneratedGroup[],
  phase: "base" | "head",
): Promise<void> {
  const files: Record<string, string> = {};
  for (const group of groups) {
    if (!Number.isInteger(group.count) || group.count < 0 || group.count > 500) {
      throw new Error(`Generated group count is outside the benchmark bound: ${group.count}`);
    }
    const contentTemplate = phase === "base" ? group.baseContentTemplate : group.headContentTemplate;
    if (contentTemplate === undefined) {
      continue;
    }
    for (let index = 0; index < group.count; index += 1) {
      const path = applyTemplate(group.pathTemplate, index);
      files[path] = applyTemplate(contentTemplate, index);
    }
  }
  await writeFiles(repository, files);
}

function fingerprintCapture(capture: EvidenceEnvelopeV1): string {
  return stableSerialize({
    capabilities: capture.capabilities.map(({ collector, status, limits }) => ({
      collector,
      status,
      limits,
    })),
    changedFiles: capture.changedFiles,
    facts: capture.facts.map(({ hunkId, reasonCode, collector, strength, value, limits }) => ({
      hunkId,
      reasonCode,
      collector,
      strength,
      value,
      ...(limits === undefined ? {} : { limits }),
    })),
    candidates: capture.candidates,
    tests: capture.tests,
    warnings: capture.warnings,
  });
}

async function safeCleanup(directory: string): Promise<void> {
  const temporaryRoot = resolve(tmpdir());
  const resolvedDirectory = resolve(directory);
  if (
    dirname(resolvedDirectory) !== temporaryRoot ||
    !basename(resolvedDirectory).startsWith("change-risk-benchmark-")
  ) {
    throw new Error(`Refusing to clean an unexpected benchmark path: ${resolvedDirectory}`);
  }
  await rm(resolvedDirectory, { recursive: true, force: true });
}

export async function buildBenchmarkFixture(caseId: string): Promise<BenchmarkFixture> {
  const recipe = await readRecipe(caseId);
  const repository = await mkdtemp(join(tmpdir(), "change-risk-benchmark-"));
  let complete = false;
  try {
    await runGit(repository, ["init", "-b", "main"]);
    await runGit(repository, ["config", "user.name", "Benchmark Fixture"]);
    await runGit(repository, ["config", "user.email", "benchmark@example.invalid"]);
    const hooksDirectory = resolve(repository, ".git", "change-risk-empty-hooks");
    await mkdir(hooksDirectory, { recursive: true });
    await runGit(repository, ["config", "core.hooksPath", hooksDirectory]);
    await writeFiles(repository, recipe.baseFiles);
    await writeGenerated(repository, recipe.generatedGroups, "base");
    await runGit(repository, ["add", "."]);
    await runGit(repository, ["commit", "--allow-empty", "-m", "base"]);
    const baseObject = (await runGit(repository, ["rev-parse", "HEAD"])).stdout.trim();

    await writeFiles(repository, recipe.headFiles);
    await writeGenerated(repository, recipe.generatedGroups, "head");
    await runGit(repository, ["add", "."]);
    await runGit(repository, ["commit", "--allow-empty", "-m", "candidate"]);
    const headObject = (await runGit(repository, ["rev-parse", "HEAD"])).stdout.trim();

    const capture = await analyzeChange({
      repository,
      scope: { kind: "range", base: baseObject, head: headObject },
    });
    complete = true;
    return {
      caseId,
      repository,
      capture,
      fingerprint: fingerprintCapture(capture),
      cleanup: async () => await safeCleanup(repository),
    };
  } finally {
    if (!complete) {
      await safeCleanup(repository);
    }
  }
}

export function locationMatchesOracle(location: SourceLocation, oracle: OracleLocation): boolean {
  return (
    location.path === oracle.path &&
    location.side === oracle.side &&
    location.start <= oracle.end &&
    oracle.start <= location.end
  );
}

function evaluate(capture: EvidenceEnvelopeV1, oracle: BenchmarkOracle): Omit<BenchmarkResult, "capture" | "fingerprint"> {
  const failures: string[] = [];
  let matchedRank: number | null = null;
  let matchedReasons: ReasonCode[] = [];

  if (oracle.mode === "positive") {
    const candidateIndex = capture.candidates
      .slice(0, 5)
      .findIndex((candidate) =>
        oracle.expectedLocations.some((location) => locationMatchesOracle(candidate.location, location)),
      );
    if (candidateIndex === -1) {
      failures.push("Known causal location was not ranked in the first five.");
    } else {
      matchedRank = candidateIndex + 1;
      matchedReasons = capture.candidates[candidateIndex]?.reasons ?? [];
      if (!matchedReasons.some((reason) => oracle.requiredAnyReasons.includes(reason))) {
        failures.push("Known causal location lacked a required wider-impact reason.");
      }
    }
  } else {
    const elevated = capture.candidates.filter((candidate) => candidate.band === "elevated").length;
    if (elevated > oracle.maximumElevated) {
      failures.push(`Expected at most ${oracle.maximumElevated} elevated candidates; saw ${elevated}.`);
    }
    if (oracle.mode === "negative" && capture.candidates.length > oracle.maximumReviewTargets) {
      failures.push(`Expected at most ${oracle.maximumReviewTargets} review targets; saw ${capture.candidates.length}.`);
    }
    if (oracle.mode === "capability") {
      for (const collector of oracle.requiredUnavailableCollectors) {
        if (!capture.capabilities.some((capability) => capability.collector === collector && capability.status === "unavailable")) {
          failures.push(`Required unavailable capability was not disclosed: ${collector}.`);
        }
      }
    }
  }

  return {
    caseId: oracle.caseId,
    passed: failures.length === 0,
    matchedRank,
    matchedReasons,
    failures,
  };
}

export async function runBenchmarkCase(caseId: string): Promise<BenchmarkResult> {
  const fixture = await buildBenchmarkFixture(caseId);
  try {
    // Load the oracle only after evidence and ranking have been captured.
    const oracle = assertOracle(await readJson(resolve(oracleRoot, `${caseId}.json`)), caseId);
    return {
      ...evaluate(fixture.capture, oracle),
      capture: fixture.capture,
      fingerprint: fixture.fingerprint,
    };
  } finally {
    await fixture.cleanup();
  }
}

export async function listBenchmarkCases(): Promise<string[]> {
  const entries = await readdir(caseRoot, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && CASE_ID.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

export async function runBenchmarkSuite(): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];
  for (const caseId of await listBenchmarkCases()) {
    results.push(await runBenchmarkCase(caseId));
  }
  return results;
}
