import { readFile, realpath } from "node:fs/promises";
import { basename, extname, isAbsolute, relative, resolve } from "node:path";
import type { CapabilityRecord, ChangedHunk, EvidenceFact } from "../contracts/evidence.js";
import { ProcessExecutionError, runProcess } from "../git/process.js";

const MAX_TERMS_PER_HUNK = 8;
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

function normalizeResultPath(path: string): string {
  return path.replace(/^\.[/\\]/u, "").replaceAll("\\", "/");
}

async function isImportReference(
  root: string,
  canonicalRoot: string,
  path: string,
  terms: readonly string[],
): Promise<boolean> {
  const target = resolve(root, ...path.split("/"));
  const pathFromRoot = relative(root, target);
  if (pathFromRoot.startsWith("..") || isAbsolute(pathFromRoot)) {
    return false;
  }
  const canonicalTarget = await realpath(target);
  const canonicalRelative = relative(canonicalRoot, canonicalTarget);
  if (canonicalRelative.startsWith("..") || isAbsolute(canonicalRelative)) {
    return false;
  }
  const buffer = await readFile(canonicalTarget);
  if (buffer.byteLength > MAX_FILE_BYTES || buffer.includes(0)) {
    return false;
  }
  return buffer
    .toString("utf8")
    .split(/\r?\n/u)
    .some((line) => IMPORT_LINE.test(line) && terms.some((term) => line.includes(term)));
}

export async function collectReferenceFacts(
  repository: string,
  hunks: readonly ChangedHunk[],
  rgCommand = "rg",
): Promise<{ facts: EvidenceFact[]; capability: CapabilityRecord; warnings: string[] }> {
  try {
    await runProcess(rgCommand, ["--version"], {
      cwd: repository,
      timeoutMs: 2_000,
      maxOutputBytes: 8_192,
    });
  } catch (error) {
    const detail = error instanceof ProcessExecutionError ? error.message : String(error);
    return {
      facts: [],
      capability: {
        collector: "text-references",
        status: "unavailable",
        details: `ripgrep unavailable: ${detail}`,
        limits: {
          maxTermsPerHunk: MAX_TERMS_PER_HUNK,
          maxMatchedFiles: MAX_MATCHED_FILES,
        },
      },
      warnings: ["Textual reference breadth is unavailable because ripgrep could not run."],
    };
  }

  const facts: EvidenceFact[] = [];
  const canonicalRoot = await realpath(repository);
  let truncated = false;
  for (const hunk of hunks) {
    const terms = termsForHunk(hunk);
    const matchedPaths = new Set<string>();
    for (const term of terms) {
      const result = await runProcess(
        rgCommand,
        [
          "--no-config",
          "--hidden",
          "--files-with-matches",
          "--fixed-strings",
          "--glob",
          "!.git/**",
          "--glob",
          "!node_modules/**",
          "--glob",
          "!vendor/**",
          "--",
          term,
          ".",
        ],
        {
          cwd: repository,
          timeoutMs: 4_000,
          maxOutputBytes: 512 * 1024,
          allowExitCodes: [0, 1],
        },
      );
      truncated ||= result.truncated;
      for (const rawPath of result.stdout.split(/\r?\n/u).filter(Boolean)) {
        const path = normalizeResultPath(rawPath);
        if (path !== hunk.path) {
          matchedPaths.add(path);
        }
        if (matchedPaths.size >= MAX_MATCHED_FILES) {
          truncated = true;
          break;
        }
      }
      if (matchedPaths.size >= MAX_MATCHED_FILES) {
        break;
      }
    }

    const samples = [...matchedPaths].sort().slice(0, 20);
    const importMatches: string[] = [];
    for (const path of [...matchedPaths].sort()) {
      if (await isImportReference(repository, canonicalRoot, path, terms)) {
        importMatches.push(path);
      }
    }
    const source = {
      tool: rgCommand,
      args: ["--no-config", "--files-with-matches", "--fixed-strings", "--", "<bounded-terms>", "."],
      cwd: repository.replaceAll("\\", "/"),
    };
    facts.push({
      id: `${hunk.id}:text-breadth`,
      hunkId: hunk.id,
      reasonCode: "TEXTUAL_REFERENCE_BREADTH",
      collector: "text-references",
      source,
      strength: "verified",
      value: { count: matchedPaths.size, samplePaths: samples, terms },
      limits: {
        maxTerms: MAX_TERMS_PER_HUNK,
        maxMatchedFiles: MAX_MATCHED_FILES,
        truncated,
      },
    });
    facts.push({
      id: `${hunk.id}:import-breadth`,
      hunkId: hunk.id,
      reasonCode: "IMPORT_REFERENCE_BREADTH",
      collector: "text-references",
      source,
      strength: "verified",
      value: { count: importMatches.length, samplePaths: importMatches.slice(0, 20), terms },
      limits: {
        maxTerms: MAX_TERMS_PER_HUNK,
        maxMatchedFiles: MAX_MATCHED_FILES,
        truncated,
      },
    });
  }

  return {
    facts,
    capability: {
      collector: "text-references",
      status: truncated ? "partial" : "available",
      details: "Bounded literal repository occurrences; these are textual, not semantic call sites.",
      limits: {
        maxTermsPerHunk: MAX_TERMS_PER_HUNK,
        maxMatchedFiles: MAX_MATCHED_FILES,
        maxFileBytesForImportClassification: MAX_FILE_BYTES,
        truncated,
      },
    },
    warnings: truncated ? ["Textual reference collection reached a configured bound."] : [],
  };
}
