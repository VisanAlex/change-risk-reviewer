import { readFile, realpath } from "node:fs/promises";
import { basename, extname, isAbsolute, relative, resolve, sep } from "node:path";
import type { CapabilityRecord, ChangedHunk, EvidenceFact } from "../contracts/evidence.js";
import { ProcessExecutionError, runGit, runProcess } from "../git/process.js";

const MAX_TERMS_PER_HUNK = 8;
const MAX_REFERENCE_HUNKS = 100;
const MAX_GENERATED_REFERENCE_HUNKS = 5;
const MAX_MATCHED_FILES = 200;
const MAX_FILE_BYTES = 256 * 1024;
const IDENTIFIER = /\b[A-Za-z_$][A-Za-z0-9_$]{2,}\b/gu;
const KEYWORDS = new Set([
  "async",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "default",
  "else",
  "export",
  "false",
  "finally",
  "for",
  "from",
  "function",
  "import",
  "interface",
  "null",
  "public",
  "return",
  "static",
  "switch",
  "throw",
  "true",
  "undefined",
  "while",
]);
const IMPORT_LINE =
  /^\s*(?:import\b|export\b.*\bfrom\b|from\s+\S+\s+import\b|(?:const|let|var)\b.*\brequire\s*\(|require\s*\(|use\b|include\b|#include\b)/u;

interface ReferenceCollectorOptions {
  rgCommand?: string | undefined;
  snapshot?: string | undefined;
}

function termsForHunk(hunk: ChangedHunk): string[] {
  const stem = basename(hunk.path, extname(hunk.path));
  const identifiers = hunk.lines
    .filter((line) => line.kind === "add" || line.kind === "delete")
    .flatMap((line) => [...line.content.matchAll(IDENTIFIER)].map((match) => match[0] ?? ""))
    .filter((term) => term.length >= 3 && !KEYWORDS.has(term.toLowerCase()));

  return [...new Set([stem, ...identifiers])]
    .filter((term) => term.length >= 3 && !/^[0-9]+$/u.test(term))
    .sort((left, right) => right.length - left.length || left.localeCompare(right))
    .slice(0, MAX_TERMS_PER_HUNK);
}

function normalizeResultPath(path: string, snapshot?: string): string {
  const withoutTree = snapshot !== undefined && path.startsWith(`${snapshot}:`)
    ? path.slice(snapshot.length + 1)
    : path;
  return withoutTree.replace(/^\.[/\\]/u, "").replaceAll("\\", "/");
}

function escapeGlobPath(path: string): string {
  return path.replaceAll("\\", "/").replace(/([?*[\]{}!])/gu, "\\$1");
}

export function submoduleExclusionGlobs(paths: readonly string[]): string[] {
  return [...new Set(paths)]
    .sort()
    .map((path) => `!${escapeGlobPath(path)}/**`);
}

async function workingTreeSubmodules(repository: string): Promise<string[]> {
  const result = await runGit(repository, ["ls-files", "--stage", "-z"], {
    timeoutMs: 4_000,
    maxOutputBytes: 512 * 1024,
  });
  return result.stdout
    .split("\0")
    .filter((entry) => entry.startsWith("160000 "))
    .map((entry) => {
      const separator = entry.indexOf("\t");
      return separator === -1 ? "" : entry.slice(separator + 1).replaceAll("\\", "/");
    })
    .filter(Boolean);
}

async function isWorkingImportReference(
  root: string,
  canonicalRoot: string,
  path: string,
  terms: readonly string[],
): Promise<boolean> {
  const target = resolve(root, ...path.split("/"));
  const pathFromRoot = relative(root, target);
  if (pathFromRoot === ".." || pathFromRoot.startsWith(`..${sep}`) || isAbsolute(pathFromRoot)) {
    return false;
  }
  const canonicalTarget = await realpath(target);
  const canonicalRelative = relative(canonicalRoot, canonicalTarget);
  if (canonicalRelative === ".." || canonicalRelative.startsWith(`..${sep}`) || isAbsolute(canonicalRelative)) {
    return false;
  }
  const buffer = await readFile(canonicalTarget);
  if (buffer.byteLength > MAX_FILE_BYTES || buffer.includes(0)) {
    return false;
  }
  return containsImportReference(buffer, terms);
}

function containsImportReference(buffer: Buffer, terms: readonly string[]): boolean {
  return buffer
    .toString("utf8")
    .split(/\r?\n/u)
    .some((line) => IMPORT_LINE.test(line) && terms.some((term) => line.includes(term)));
}

function orderedHunks(hunks: readonly ChangedHunk[]): ChangedHunk[] {
  return [...hunks].sort(
    (left, right) =>
      Number(left.generated) - Number(right.generated) ||
      left.path.localeCompare(right.path) ||
      left.location.start - right.location.start ||
      left.id.localeCompare(right.id),
  );
}

function selectedReferenceHunks(hunks: readonly ChangedHunk[]): ChangedHunk[] {
  const ordered = orderedHunks(hunks);
  return [
    ...ordered.filter((hunk) => !hunk.generated).slice(0, MAX_REFERENCE_HUNKS),
    ...ordered.filter((hunk) => hunk.generated).slice(0, MAX_GENERATED_REFERENCE_HUNKS),
  ];
}

async function collectMatches(
  repository: string,
  hunk: ChangedHunk,
  terms: readonly string[],
  options: { rgCommand: string; snapshot: string | undefined },
  submoduleGlobs: readonly string[],
): Promise<{
  matchedPaths: Set<string>;
  snapshotImportPaths: Set<string>;
  truncated: boolean;
  source: EvidenceFact["source"];
}> {
  if (terms.length === 0) {
    return {
      matchedPaths: new Set(),
      snapshotImportPaths: new Set(),
      truncated: false,
      source: {
        tool: options.snapshot === undefined ? options.rgCommand : "git",
        args: ["<no-searchable-terms>"],
        cwd: repository.replaceAll("\\", "/"),
      },
    };
  }

  const termArgs = terms.flatMap((term) => ["-e", term]);
  const result = options.snapshot === undefined
    ? await runProcess(
        options.rgCommand,
        [
          "--no-config",
          "--hidden",
          "--files-with-matches",
          "--null",
          "--fixed-strings",
          "--glob",
          "!.git/**",
          "--glob",
          "!node_modules/**",
          "--glob",
          "!vendor/**",
          ...submoduleGlobs.flatMap((glob) => ["--glob", glob]),
          ...termArgs,
          "--",
          ".",
        ],
        {
          cwd: repository,
          timeoutMs: 4_000,
          maxOutputBytes: 512 * 1024,
          allowExitCodes: [0, 1],
        },
      )
    : await runGit(
        repository,
        ["grep", "-n", "-z", "--full-name", "-F", ...termArgs, options.snapshot, "--"],
        {
          timeoutMs: 4_000,
          maxOutputBytes: 512 * 1024,
          allowExitCodes: [0, 1],
        },
      );

  const matchedPaths = new Set<string>();
  const snapshotImportPaths = new Set<string>();
  let truncated = result.truncated;
  if (options.snapshot === undefined) {
    for (const rawPath of result.stdout.split("\0").filter(Boolean)) {
      const path = normalizeResultPath(rawPath);
      if (path !== hunk.path) {
        matchedPaths.add(path);
      }
      if (matchedPaths.size >= MAX_MATCHED_FILES) {
        truncated = true;
        break;
      }
    }
  } else {
    let cursor = 0;
    while (cursor < result.stdout.length) {
      const pathEnd = result.stdout.indexOf("\0", cursor);
      const lineEnd = result.stdout.indexOf("\0", pathEnd + 1);
      const contentEnd = result.stdout.indexOf("\n", lineEnd + 1);
      if (pathEnd === -1 || lineEnd === -1) {
        truncated = true;
        break;
      }
      const path = normalizeResultPath(result.stdout.slice(cursor, pathEnd), options.snapshot);
      const content = result.stdout.slice(lineEnd + 1, contentEnd === -1 ? undefined : contentEnd);
      if (path !== hunk.path) {
        matchedPaths.add(path);
        if (IMPORT_LINE.test(content) && terms.some((term) => content.includes(term))) {
          snapshotImportPaths.add(path);
        }
      }
      if (matchedPaths.size >= MAX_MATCHED_FILES) {
        truncated = true;
        break;
      }
      if (contentEnd === -1) {
        break;
      }
      cursor = contentEnd + 1;
    }
  }
  return {
    matchedPaths,
    snapshotImportPaths,
    truncated,
    source: {
      tool: options.snapshot === undefined ? options.rgCommand : "git",
      args: options.snapshot === undefined
        ? ["--no-config", "--files-with-matches", "--null", "--fixed-strings", "--", "<bounded-terms>", "."]
        : ["grep", "-n", "-z", "--fixed-strings", "<bounded-terms>", options.snapshot, "--"],
      cwd: repository.replaceAll("\\", "/"),
    },
  };
}

export async function collectReferenceFacts(
  repository: string,
  hunks: readonly ChangedHunk[],
  options: ReferenceCollectorOptions = {},
): Promise<{ facts: EvidenceFact[]; capability: CapabilityRecord; warnings: string[] }> {
  const rgCommand = options.rgCommand ?? "rg";
  let submoduleGlobs: string[] = [];
  if (options.snapshot === undefined) {
    try {
      await runProcess(rgCommand, ["--version"], {
        cwd: repository,
        timeoutMs: 2_000,
        maxOutputBytes: 8_192,
      });
      submoduleGlobs = submoduleExclusionGlobs(await workingTreeSubmodules(repository));
    } catch (error) {
      const detail = error instanceof ProcessExecutionError ? error.message : String(error);
      return {
        facts: [],
        capability: {
          collector: "text-references",
          status: "unavailable",
          details: `Working-tree reference search unavailable: ${detail}`,
          limits: {
            maxTermsPerHunk: MAX_TERMS_PER_HUNK,
            maxMatchedFiles: MAX_MATCHED_FILES,
          },
        },
        warnings: ["Textual reference breadth is unavailable because the working-tree search could not run safely."],
      };
    }
  }

  const selectedHunks = selectedReferenceHunks(hunks);
  const skippedHunks = hunks.length - selectedHunks.length;
  const facts: EvidenceFact[] = [];
  const canonicalRoot = options.snapshot === undefined ? await realpath(repository) : repository;
  let truncated = skippedHunks > 0;
  let failure: string | null = null;

  for (const hunk of selectedHunks) {
    try {
      const terms = termsForHunk(hunk);
      const matches = await collectMatches(
        repository,
        hunk,
        terms,
        { rgCommand, snapshot: options.snapshot },
        submoduleGlobs,
      );
      truncated ||= matches.truncated;
      const importMatches = [...matches.snapshotImportPaths].sort();
      if (options.snapshot === undefined) {
        for (const path of [...matches.matchedPaths].sort()) {
          if (await isWorkingImportReference(repository, canonicalRoot, path, terms)) {
            importMatches.push(path);
          }
        }
      }
      const limits = {
        maxTerms: MAX_TERMS_PER_HUNK,
        maxMatchedFiles: MAX_MATCHED_FILES,
        truncated: matches.truncated,
      };
      facts.push({
        id: `${hunk.id}:text-breadth`,
        hunkId: hunk.id,
        reasonCode: "TEXTUAL_REFERENCE_BREADTH",
        collector: "text-references",
        source: matches.source,
        strength: "verified",
        value: {
          count: matches.matchedPaths.size,
          samplePaths: [...matches.matchedPaths].sort().slice(0, 20),
          terms,
        },
        limits,
      });
      facts.push({
        id: `${hunk.id}:import-breadth`,
        hunkId: hunk.id,
        reasonCode: "IMPORT_REFERENCE_BREADTH",
        collector: "text-references",
        source: matches.source,
        strength: "verified",
        value: { count: importMatches.length, samplePaths: importMatches.slice(0, 20), terms },
        limits,
      });
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
      truncated = true;
      break;
    }
  }

  const status: CapabilityRecord["status"] =
    facts.length === 0 && failure !== null ? "unavailable" : truncated ? "partial" : "available";
  return {
    facts,
    capability: {
      collector: "text-references",
      status,
      details: failure === null
        ? "Bounded literal repository occurrences; these are textual, not semantic call sites."
        : `Reference collection was incomplete: ${failure}`,
      limits: {
        maxTermsPerHunk: MAX_TERMS_PER_HUNK,
        maxHunks: MAX_REFERENCE_HUNKS,
        maxGeneratedHunks: MAX_GENERATED_REFERENCE_HUNKS,
        maxMatchedFiles: MAX_MATCHED_FILES,
        maxFileBytesForImportClassification: MAX_FILE_BYTES,
        skippedHunks,
        excludedSubmodules: submoduleGlobs.length,
        snapshot: options.snapshot === undefined ? "working-tree" : "selected-head",
        truncated,
      },
    },
    warnings: truncated
      ? ["Textual reference evidence is incomplete; completed facts were retained."]
      : [],
  };
}
