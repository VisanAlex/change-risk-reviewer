import { lstat, readFile, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import type { ChangedHunk, RangeScope, ReviewScope, WorkingScope } from "../contracts/evidence.js";
import { parseUnifiedDiff } from "./diff.js";
import { ProcessExecutionError, runGit } from "./process.js";

const MAX_UNTRACKED_BYTES = 256 * 1024;

export class ScopeResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScopeResolutionError";
  }
}

export interface ResolvedChange {
  scope: ReviewScope;
  repositoryRoot: string;
  headObject: string | null;
  dirty: boolean;
  hunks: ChangedHunk[];
  binaryFiles: string[];
  diffTruncated: boolean;
  warnings: string[];
}

interface ScopeResolutionOptions {
  maxDiffOutputBytes?: number;
}

async function repositoryRoot(input: string): Promise<string> {
  const resolvedInput = await realpath(resolve(input));
  try {
    const result = await runGit(resolvedInput, ["rev-parse", "--show-toplevel"]);
    return await realpath(result.stdout.trim());
  } catch (error) {
    throw new ScopeResolutionError(`Not a Git repository: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function assertContained(root: string, target: string): void {
  const pathFromRoot = relative(root, target);
  if (pathFromRoot === ".." || pathFromRoot.startsWith(`..${sep}`) || isAbsolute(pathFromRoot)) {
    throw new ScopeResolutionError(`Resolved path leaves the repository: ${target}`);
  }
}

async function resolveHead(root: string): Promise<string | null> {
  try {
    return (await runGit(root, ["rev-parse", "--verify", "HEAD"])).stdout.trim();
  } catch {
    return null;
  }
}

function synthesizeNewFilePatch(path: string, content: string): string {
  const normalized = content.replaceAll("\r\n", "\n");
  const contentLines = normalized.endsWith("\n")
    ? normalized.slice(0, -1).split("\n")
    : normalized.split("\n");
  const effectiveLines = contentLines.length === 1 && contentLines[0] === "" ? [] : contentLines;
  const additions = effectiveLines.map((line) => `+${line}`).join("\n");
  return `diff --git a/${path} b/${path}
new file mode 100644
--- /dev/null
+++ b/${path}
@@ -0,0 +1,${effectiveLines.length} @@
${additions}
`;
}

function synthesizeBinaryHunk(path: string): ChangedHunk {
  return {
    id: `${path}:1:0:binary`,
    path,
    header: "Binary file added",
    oldRange: { start: 0, count: 0 },
    newRange: { start: 1, count: 0 },
    location: {
      path,
      side: "current",
      start: 1,
      end: 1,
      deleted: false,
    },
    lines: [],
    editKind: "added",
    binary: true,
    generated: false,
  };
}

async function collectUntracked(root: string): Promise<{
  hunks: ChangedHunk[];
  binaryFiles: string[];
  warnings: string[];
}> {
  const result = await runGit(root, ["ls-files", "--others", "--exclude-standard", "-z"]);
  const paths = result.stdout.split("\0").filter(Boolean).sort();
  const hunks: ChangedHunk[] = [];
  const binaryFiles: string[] = [];
  const warnings: string[] = [];

  for (const path of paths) {
    if (path.includes("\n") || path.includes("\r")) {
      warnings.push(`Skipped untracked path with a line break: ${JSON.stringify(path)}`);
      continue;
    }
    const target = resolve(root, ...path.split("/"));
    assertContained(root, target);
    const metadata = await lstat(target);
    if (metadata.isSymbolicLink()) {
      warnings.push(`Untracked symlink was recorded without following it: ${path}`);
      continue;
    }
    if (!metadata.isFile()) {
      continue;
    }
    if (metadata.size > MAX_UNTRACKED_BYTES) {
      binaryFiles.push(path);
      hunks.push(synthesizeBinaryHunk(path));
      warnings.push(`Untracked file exceeded the ${MAX_UNTRACKED_BYTES}-byte content cap: ${path}`);
      continue;
    }
    const buffer = await readFile(target);
    if (buffer.includes(0)) {
      binaryFiles.push(path);
      hunks.push(synthesizeBinaryHunk(path));
      continue;
    }
    const parsed = parseUnifiedDiff(synthesizeNewFilePatch(path.replaceAll("\\", "/"), buffer.toString("utf8")));
    hunks.push(...parsed);
  }

  return { hunks, binaryFiles, warnings };
}

function stableHunks(hunks: ChangedHunk[]): ChangedHunk[] {
  const unique = new Map<string, ChangedHunk>();
  for (const hunk of hunks) {
    const key = `${hunk.path}\0${hunk.oldRange.start}\0${hunk.newRange.start}\0${hunk.header}`;
    unique.set(key, hunk);
  }
  return [...unique.values()].sort(
    (left, right) =>
      left.path.localeCompare(right.path) ||
      left.location.start - right.location.start ||
      left.id.localeCompare(right.id),
  );
}

export async function resolveWorkingChange(
  input: string,
  options: ScopeResolutionOptions = {},
): Promise<ResolvedChange> {
  const root = await repositoryRoot(input);
  const headObject = await resolveHead(root);
  if (headObject === null) {
    throw new ScopeResolutionError("Working change review requires a repository with an initial commit");
  }
  const diff = await runGit(root, [
    "diff",
    "--no-ext-diff",
    "--no-textconv",
    "--find-renames",
    "--binary",
    "HEAD",
    "--",
  ], options.maxDiffOutputBytes === undefined ? {} : { maxOutputBytes: options.maxDiffOutputBytes });
  const status = await runGit(root, ["status", "--porcelain=v1", "-uno"]);
  const untracked = await collectUntracked(root);
  const trackedHunks = parseUnifiedDiff(diff.stdout);
  const binaryFiles = [
    ...trackedHunks.filter((hunk) => hunk.binary).map((hunk) => hunk.path),
    ...untracked.binaryFiles,
  ].sort();
  const scope: WorkingScope = { kind: "working", headObject };

  return {
    scope,
    repositoryRoot: root.replaceAll("\\", "/"),
    headObject,
    dirty: status.stdout.length > 0 || untracked.hunks.length > 0 || untracked.binaryFiles.length > 0,
    hunks: stableHunks([...trackedHunks, ...untracked.hunks]),
    binaryFiles: [...new Set(binaryFiles)],
    diffTruncated: diff.truncated,
    warnings: [
      ...untracked.warnings,
      ...(diff.truncated ? ["Git diff output was truncated at the configured byte bound."] : []),
    ],
  };
}

function validateRevision(revision: string, label: string): void {
  if (revision.length === 0 || revision.startsWith("-") || /[\0\r\n]/u.test(revision)) {
    throw new ScopeResolutionError(`Invalid ${label} revision`);
  }
}

async function resolveCommit(root: string, revision: string, label: string): Promise<string> {
  validateRevision(revision, label);
  try {
    const result = await runGit(root, ["rev-parse", "--verify", "--end-of-options", `${revision}^{commit}`]);
    return result.stdout.trim();
  } catch (error) {
    const detail = error instanceof ProcessExecutionError ? error.stderr.trim() : String(error);
    throw new ScopeResolutionError(`Could not resolve ${label} revision ${JSON.stringify(revision)}${detail ? `: ${detail}` : ""}`);
  }
}

export async function resolveRevisionRange(
  input: string,
  baseInput: string,
  headInput: string,
  options: ScopeResolutionOptions = {},
): Promise<ResolvedChange> {
  const root = await repositoryRoot(input);
  const baseObject = await resolveCommit(root, baseInput, "base");
  const headObject = await resolveCommit(root, headInput, "head");
  let mergeBaseObject: string;
  try {
    mergeBaseObject = (await runGit(root, ["merge-base", baseObject, headObject])).stdout.trim();
  } catch {
    throw new ScopeResolutionError("The selected revisions do not have a merge base");
  }
  const diff = await runGit(root, [
    "diff",
    "--no-ext-diff",
    "--no-textconv",
    "--find-renames",
    "--binary",
    mergeBaseObject,
    headObject,
    "--",
  ], options.maxDiffOutputBytes === undefined ? {} : { maxOutputBytes: options.maxDiffOutputBytes });
  const hunks = parseUnifiedDiff(diff.stdout);
  const scope: RangeScope = {
    kind: "range",
    baseInput,
    headInput,
    baseObject,
    headObject,
    mergeBaseObject,
  };

  return {
    scope,
    repositoryRoot: root.replaceAll("\\", "/"),
    headObject,
    dirty: false,
    hunks: stableHunks(hunks),
    binaryFiles: hunks.filter((hunk) => hunk.binary).map((hunk) => hunk.path).sort(),
    diffTruncated: diff.truncated,
    warnings: diff.truncated
      ? ["Git diff output was truncated at the configured byte bound."]
      : [],
  };
}
