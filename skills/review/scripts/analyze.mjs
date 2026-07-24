// src/internal-entry.ts
import process2 from "node:process";
import { resolve as resolve3 } from "node:path";

// src/contracts/evidence.ts
function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function assertEvidenceEnvelopeV1(value) {
  if (!isObject(value) || value.schemaVersion !== "1") {
    throw new Error("Evidence envelope must use schemaVersion 1");
  }
  if (!isObject(value.scope) || !["working", "range"].includes(String(value.scope.kind))) {
    throw new Error("Evidence envelope has an invalid scope");
  }
  if (!isObject(value.repository) || typeof value.repository.root !== "string") {
    throw new Error("Evidence envelope has invalid repository metadata");
  }
  if (!Array.isArray(value.facts)) {
    throw new Error("Evidence envelope facts must be an array");
  }
  for (const fact of value.facts) {
    if (!isObject(fact) || !isObject(fact.source) || typeof fact.source.tool !== "string" || !Array.isArray(fact.source.args)) {
      throw new Error("Every evidence fact must include a source command");
    }
    if (fact.strength !== "verified") {
      throw new Error("Deterministic evidence facts must be marked verified");
    }
  }
  for (const field of ["capabilities", "changedFiles", "candidates", "warnings"]) {
    if (!Array.isArray(value[field])) {
      throw new Error(`Evidence envelope ${field} must be an array`);
    }
  }
  if (!isObject(value.tests)) {
    throw new Error("Evidence envelope test signals are missing");
  }
  return value;
}
function normalizeForSerialization(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeForSerialization);
  }
  if (isObject(value)) {
    return Object.fromEntries(
      Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => [key, normalizeForSerialization(child)])
    );
  }
  return value;
}
function stableSerialize(value) {
  return JSON.stringify(normalizeForSerialization(value));
}

// src/collectors/file-signals.ts
import { basename, extname } from "node:path";
var CONTROL_TOKENS = /\b(if|else|switch|case|return|throw|catch|finally|break|continue|await|yield)\b|&&|\|\||\?\?/gu;
var PUBLIC_TOKENS = /\b(export|public|protected|interface|type|class|def|function|func|module|package|route|handler|endpoint)\b/gu;
function normalizedPath(path) {
  return `/${path.toLowerCase().replaceAll("\\", "/")}`;
}
function classifyPath(path) {
  const normalized = normalizedPath(path);
  const filename = basename(normalized);
  const extension = extname(filename);
  const roles2 = [];
  const generated = /\/(generated|gen|dist|build|coverage|vendor|node_modules)\//u.test(normalized) || /\.(generated|g|min)\.[^.]+$/u.test(filename) || /(?:^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|cargo\.lock|composer\.lock)$/u.test(normalized);
  if (/\/(core|shared|common|kernel|platform|infrastructure)\//u.test(normalized)) {
    roles2.push("shared-core");
  }
  if (/\/(auth|authorization|permissions?|policies?)\//u.test(normalized) || /(auth|policy|permission)/u.test(filename)) {
    roles2.push("auth-policy");
  }
  if (/\/(routes?|routing)\//u.test(normalized) || /(route|router)/u.test(filename)) {
    roles2.push("routing");
  }
  if (/\/(config|configuration)\//u.test(normalized) || [".json", ".yaml", ".yml", ".toml", ".ini"].includes(extension) || /(?:^|\/)(dockerfile|makefile)$/u.test(normalized)) {
    roles2.push("configuration");
  }
  if (/\/(migrations?|schema)\//u.test(normalized) || /(migration|schema)/u.test(filename)) {
    roles2.push("migration");
  }
  if (/(^|\/)(tests?|spec|__tests__)\//u.test(normalized) || /\.(test|spec)\.[^.]+$/u.test(filename)) {
    roles2.push("test");
  }
  if (!normalized.includes("/skills/") && (normalized.includes("/docs/") || /\.(md|mdx|rst|adoc)$/u.test(filename))) {
    roles2.push("documentation");
  }
  return { generated, roles: [...new Set(roles2)].sort() };
}
function changedText(hunk) {
  return hunk.lines.filter((line) => line.kind === "add" || line.kind === "delete").map((line) => line.content).join("\n");
}
function collectFileSignalFacts(hunks) {
  const facts = [];
  const classifiedHunks = hunks.map((input) => {
    const classification = classifyPath(input.path);
    const hunk = { ...input, generated: classification.generated };
    const source = { tool: "path-classifier", args: [hunk.path] };
    if (classification.roles.length > 0) {
      facts.push({
        id: `${hunk.id}:file-role`,
        hunkId: hunk.id,
        reasonCode: "FILE_ROLE",
        collector: "file-signals",
        source,
        strength: "verified",
        value: { roles: classification.roles }
      });
    }
    if (classification.generated) {
      facts.push({
        id: `${hunk.id}:generated`,
        hunkId: hunk.id,
        reasonCode: "GENERATED_FILE",
        collector: "file-signals",
        source,
        strength: "verified",
        value: { generated: true }
      });
    }
    if (hunk.binary) {
      facts.push({
        id: `${hunk.id}:binary`,
        hunkId: hunk.id,
        reasonCode: "BINARY_CHANGE",
        collector: "file-signals",
        source,
        strength: "verified",
        value: { binary: true }
      });
    }
    const text = changedText(hunk);
    const controlTokens = [...text.matchAll(CONTROL_TOKENS)].map((match) => match[0]);
    if (controlTokens.length > 0) {
      facts.push({
        id: `${hunk.id}:control`,
        hunkId: hunk.id,
        reasonCode: "CONTROL_FLOW_TOKEN",
        collector: "file-signals",
        source: { tool: "token-pattern", args: ["control-flow", hunk.path] },
        strength: "verified",
        value: { tokens: [...new Set(controlTokens)].sort() }
      });
    }
    const publicTokens = [...text.matchAll(PUBLIC_TOKENS)].map((match) => match[0]);
    if (publicTokens.length > 0) {
      facts.push({
        id: `${hunk.id}:public`,
        hunkId: hunk.id,
        reasonCode: "PUBLIC_SURFACE_TOKEN",
        collector: "file-signals",
        source: { tool: "token-pattern", args: ["public-surface", hunk.path] },
        strength: "verified",
        value: { tokens: [...new Set(publicTokens)].sort() }
      });
    }
    return hunk;
  });
  return { hunks: classifiedHunks, facts };
}

// src/git/process.ts
import { spawn } from "node:child_process";
var ProcessExecutionError = class extends Error {
  code;
  stderr;
  constructor(message, code, stderr = "") {
    super(message);
    this.name = "ProcessExecutionError";
    this.code = code;
    this.stderr = stderr;
  }
};
async function runProcess(command, args, options) {
  const timeoutMs = options.timeoutMs ?? 1e4;
  const maxOutputBytes = options.maxOutputBytes ?? 4 * 1024 * 1024;
  const allowExitCodes = options.allowExitCodes ?? [0];
  return await new Promise((resolve4, reject) => {
    const child = spawn(command, [...args], {
      cwd: options.cwd,
      env: {
        ...process.env,
        GIT_EXTERNAL_DIFF: "",
        GIT_OPTIONAL_LOCKS: "0",
        GIT_PAGER: "cat",
        LC_ALL: "C",
        PAGER: "cat"
      },
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    let outputBytes = 0;
    let truncated = false;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);
    const capture = (target, chunk) => {
      const remaining = Math.max(0, maxOutputBytes - outputBytes);
      if (remaining === 0) {
        truncated = true;
        return;
      }
      const accepted = chunk.subarray(0, remaining);
      outputBytes += accepted.byteLength;
      if (accepted.byteLength < chunk.byteLength) {
        truncated = true;
      }
      if (target === "stdout") {
        stdout += accepted.toString("utf8");
      } else {
        stderr += accepted.toString("utf8");
      }
    };
    child.stdout.on("data", (chunk) => capture("stdout", chunk));
    child.stderr.on("data", (chunk) => capture("stderr", chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(new ProcessExecutionError(`Could not start ${command}: ${error.code ?? error.message}`, null));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new ProcessExecutionError(`${command} timed out after ${timeoutMs}ms`, code, stderr));
        return;
      }
      const normalizedCode = code ?? -1;
      if (!allowExitCodes.includes(normalizedCode)) {
        reject(new ProcessExecutionError(`${command} exited with ${normalizedCode}`, code, stderr));
        return;
      }
      resolve4({ code: normalizedCode, stdout, stderr, truncated });
    });
  });
}
async function runGit(repository, args, options = {}) {
  return await runProcess(
    "git",
    ["--no-pager", "-c", "core.quotePath=false", "-c", "core.fsmonitor=false", ...args],
    { ...options, cwd: repository }
  );
}

// src/collectors/history.ts
var HISTORY_COMMITS = 100;
var MAX_HISTORY_PATHS = 100;
var MAX_GENERATED_HISTORY_PATHS = 5;
function selectedPaths(hunks) {
  const generatedByPath = /* @__PURE__ */ new Map();
  for (const hunk of hunks) {
    generatedByPath.set(hunk.path, (generatedByPath.get(hunk.path) ?? true) && hunk.generated);
  }
  const paths = [...generatedByPath].sort(([left], [right]) => left.localeCompare(right));
  const ordinary = paths.filter(([, generated2]) => !generated2).map(([path]) => path).slice(0, MAX_HISTORY_PATHS);
  const generated = paths.filter(([, isGenerated]) => isGenerated).map(([path]) => path).slice(0, MAX_GENERATED_HISTORY_PATHS);
  const selected = [...ordinary, ...generated];
  return { selected, skipped: paths.length - selected.length };
}
function parseCommitPaths(output) {
  const commits = [];
  let current;
  for (const token of output.split("\0").filter(Boolean)) {
    if (token.startsWith("__CRR_COMMIT__")) {
      current = { commit: token.slice("__CRR_COMMIT__".length), paths: /* @__PURE__ */ new Set() };
      commits.push(current);
    } else if (current !== void 0) {
      current.paths.add(token.replace(/^\r?\n/u, "").replaceAll("\\", "/"));
    }
  }
  return commits;
}
async function collectHistoryFacts(repository, hunks, revision) {
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
          revision: "selected-head"
        }
      },
      warnings: []
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
      ...selected
    ];
    const result = await runGit(repository, args, {
      timeoutMs: 6e3,
      maxOutputBytes: 2 * 1024 * 1024
    });
    const commits = parseCommitPaths(result.stdout);
    const facts = [];
    const source = {
      tool: "git",
      args,
      cwd: repository.replaceAll("\\", "/")
    };
    for (const hunk of hunks.filter((candidate) => selected.includes(candidate.path))) {
      const matchingCommits = commits.filter((commit) => commit.paths.has(hunk.path));
      const cochanged = new Set(
        matchingCommits.flatMap((commit) => [...commit.paths].filter((path) => path !== hunk.path))
      );
      facts.push({
        id: `${hunk.id}:history-frequency`,
        hunkId: hunk.id,
        reasonCode: "HISTORY_CHANGE_FREQUENCY",
        collector: "git-history",
        source,
        strength: "verified",
        value: { count: matchingCommits.length, window: HISTORY_COMMITS }
      });
      facts.push({
        id: `${hunk.id}:history-cochange`,
        hunkId: hunk.id,
        reasonCode: "HISTORY_COCHANGE_BREADTH",
        collector: "git-history",
        source,
        strength: "verified",
        value: { count: cochanged.size, samplePaths: [...cochanged].sort().slice(0, 20) }
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
          truncated: result.truncated
        }
      },
      warnings: partial ? ["Git history evidence is incomplete; completed facts were retained."] : []
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
          revision: "selected-head"
        }
      },
      warnings: ["Git history evidence is unavailable."]
    };
  }
}

// src/collectors/references.ts
import { readFile, realpath } from "node:fs/promises";
import { basename as basename2, extname as extname2, isAbsolute, relative, resolve, sep } from "node:path";
var MAX_TERMS_PER_HUNK = 8;
var MAX_REFERENCE_HUNKS = 100;
var MAX_GENERATED_REFERENCE_HUNKS = 5;
var MAX_MATCHED_FILES = 200;
var MAX_FILE_BYTES = 256 * 1024;
var IDENTIFIER = /\b[A-Za-z_$][A-Za-z0-9_$]{2,}\b/gu;
var KEYWORDS = /* @__PURE__ */ new Set([
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
  "while"
]);
var IMPORT_LINE = /^\s*(?:import\b|export\b.*\bfrom\b|from\s+\S+\s+import\b|(?:const|let|var)\b.*\brequire\s*\(|require\s*\(|use\b|include\b|#include\b)/u;
function termsForHunk(hunk) {
  const stem2 = basename2(hunk.path, extname2(hunk.path));
  const identifiers = hunk.lines.filter((line) => line.kind === "add" || line.kind === "delete").flatMap((line) => [...line.content.matchAll(IDENTIFIER)].map((match) => match[0] ?? "")).filter((term) => term.length >= 3 && !KEYWORDS.has(term.toLowerCase()));
  return [.../* @__PURE__ */ new Set([stem2, ...identifiers])].filter((term) => term.length >= 3 && !/^[0-9]+$/u.test(term)).sort((left, right) => right.length - left.length || left.localeCompare(right)).slice(0, MAX_TERMS_PER_HUNK);
}
function normalizeResultPath(path, snapshot) {
  const withoutTree = snapshot !== void 0 && path.startsWith(`${snapshot}:`) ? path.slice(snapshot.length + 1) : path;
  return withoutTree.replace(/^\.[/\\]/u, "").replaceAll("\\", "/");
}
function escapeGlobPath(path) {
  return path.replaceAll("\\", "/").replace(/([?*[\]{}!])/gu, "\\$1");
}
function submoduleExclusionGlobs(paths) {
  return [...new Set(paths)].sort().map((path) => `!${escapeGlobPath(path)}/**`);
}
async function workingTreeSubmodules(repository) {
  const result = await runGit(repository, ["ls-files", "--stage", "-z"], {
    timeoutMs: 4e3,
    maxOutputBytes: 512 * 1024
  });
  return result.stdout.split("\0").filter((entry) => entry.startsWith("160000 ")).map((entry) => {
    const separator = entry.indexOf("	");
    return separator === -1 ? "" : entry.slice(separator + 1).replaceAll("\\", "/");
  }).filter(Boolean);
}
async function isWorkingImportReference(root, canonicalRoot, path, terms) {
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
function containsImportReference(buffer, terms) {
  return buffer.toString("utf8").split(/\r?\n/u).some((line) => IMPORT_LINE.test(line) && terms.some((term) => line.includes(term)));
}
function orderedHunks(hunks) {
  return [...hunks].sort(
    (left, right) => Number(left.generated) - Number(right.generated) || left.path.localeCompare(right.path) || left.location.start - right.location.start || left.id.localeCompare(right.id)
  );
}
function selectedReferenceHunks(hunks) {
  const ordered = orderedHunks(hunks);
  return [
    ...ordered.filter((hunk) => !hunk.generated).slice(0, MAX_REFERENCE_HUNKS),
    ...ordered.filter((hunk) => hunk.generated).slice(0, MAX_GENERATED_REFERENCE_HUNKS)
  ];
}
async function collectMatches(repository, hunk, terms, options, submoduleGlobs) {
  if (terms.length === 0) {
    return {
      matchedPaths: /* @__PURE__ */ new Set(),
      snapshotImportPaths: /* @__PURE__ */ new Set(),
      truncated: false,
      source: {
        tool: options.snapshot === void 0 ? options.rgCommand : "git",
        args: ["<no-searchable-terms>"],
        cwd: repository.replaceAll("\\", "/")
      }
    };
  }
  const termArgs = terms.flatMap((term) => ["-e", term]);
  const result = options.snapshot === void 0 ? await runProcess(
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
      "."
    ],
    {
      cwd: repository,
      timeoutMs: 4e3,
      maxOutputBytes: 512 * 1024,
      allowExitCodes: [0, 1]
    }
  ) : await runGit(
    repository,
    ["grep", "-n", "-z", "--full-name", "-F", ...termArgs, options.snapshot, "--"],
    {
      timeoutMs: 4e3,
      maxOutputBytes: 512 * 1024,
      allowExitCodes: [0, 1]
    }
  );
  const matchedPaths = /* @__PURE__ */ new Set();
  const snapshotImportPaths = /* @__PURE__ */ new Set();
  let truncated = result.truncated;
  if (options.snapshot === void 0) {
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
      const content = result.stdout.slice(lineEnd + 1, contentEnd === -1 ? void 0 : contentEnd);
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
      tool: options.snapshot === void 0 ? options.rgCommand : "git",
      args: options.snapshot === void 0 ? ["--no-config", "--files-with-matches", "--null", "--fixed-strings", "--", "<bounded-terms>", "."] : ["grep", "-n", "-z", "--fixed-strings", "<bounded-terms>", options.snapshot, "--"],
      cwd: repository.replaceAll("\\", "/")
    }
  };
}
async function collectReferenceFacts(repository, hunks, options = {}) {
  const rgCommand = options.rgCommand ?? "rg";
  let submoduleGlobs = [];
  if (options.snapshot === void 0) {
    try {
      await runProcess(rgCommand, ["--version"], {
        cwd: repository,
        timeoutMs: 2e3,
        maxOutputBytes: 8192
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
            maxMatchedFiles: MAX_MATCHED_FILES
          }
        },
        warnings: ["Textual reference breadth is unavailable because the working-tree search could not run safely."]
      };
    }
  }
  const selectedHunks = selectedReferenceHunks(hunks);
  const skippedHunks = hunks.length - selectedHunks.length;
  const facts = [];
  const canonicalRoot = options.snapshot === void 0 ? await realpath(repository) : repository;
  let truncated = skippedHunks > 0;
  let failure = null;
  for (const hunk of selectedHunks) {
    try {
      const terms = termsForHunk(hunk);
      const matches = await collectMatches(
        repository,
        hunk,
        terms,
        { rgCommand, snapshot: options.snapshot },
        submoduleGlobs
      );
      truncated ||= matches.truncated;
      const importMatches = [...matches.snapshotImportPaths].sort();
      if (options.snapshot === void 0) {
        for (const path of [...matches.matchedPaths].sort()) {
          if (await isWorkingImportReference(repository, canonicalRoot, path, terms)) {
            importMatches.push(path);
          }
        }
      }
      const limits = {
        maxTerms: MAX_TERMS_PER_HUNK,
        maxMatchedFiles: MAX_MATCHED_FILES,
        truncated: matches.truncated
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
          terms
        },
        limits
      });
      facts.push({
        id: `${hunk.id}:import-breadth`,
        hunkId: hunk.id,
        reasonCode: "IMPORT_REFERENCE_BREADTH",
        collector: "text-references",
        source: matches.source,
        strength: "verified",
        value: { count: importMatches.length, samplePaths: importMatches.slice(0, 20), terms },
        limits
      });
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
      truncated = true;
      break;
    }
  }
  const status = facts.length === 0 && failure !== null ? "unavailable" : truncated ? "partial" : "available";
  return {
    facts,
    capability: {
      collector: "text-references",
      status,
      details: failure === null ? "Bounded literal repository occurrences; these are textual, not semantic call sites." : `Reference collection was incomplete: ${failure}`,
      limits: {
        maxTermsPerHunk: MAX_TERMS_PER_HUNK,
        maxHunks: MAX_REFERENCE_HUNKS,
        maxGeneratedHunks: MAX_GENERATED_REFERENCE_HUNKS,
        maxMatchedFiles: MAX_MATCHED_FILES,
        maxFileBytesForImportClassification: MAX_FILE_BYTES,
        skippedHunks,
        excludedSubmodules: submoduleGlobs.length,
        snapshot: options.snapshot === void 0 ? "working-tree" : "selected-head",
        truncated
      }
    },
    warnings: truncated ? ["Textual reference evidence is incomplete; completed facts were retained."] : []
  };
}

// src/collectors/tests.ts
import { basename as basename3, extname as extname3 } from "node:path";
var TEST_PATH = /(^|\/)(tests?|spec|__tests__)(\/|$)|\.(test|spec)\.[^/]+$/u;
function stem(path) {
  return basename3(path, extname3(path)).replace(/\.(test|spec)$/u, "");
}
async function collectTestSignals(repository, hunks, snapshot) {
  const listArgs = snapshot === void 0 ? ["ls-files", "-co", "--exclude-standard", "-z"] : ["ls-tree", "-r", "--name-only", "-z", snapshot];
  const listed = await runGit(repository, listArgs);
  const repositoryTests = [...new Set(listed.stdout.split("\0").filter(Boolean).map((path) => path.replaceAll("\\", "/")))].filter((path) => TEST_PATH.test(path)).sort();
  const changedPaths = [...new Set(hunks.map((hunk) => hunk.path))].sort();
  const changed = changedPaths.filter((path) => TEST_PATH.test(path));
  const changedSourceStems = new Set(changedPaths.filter((path) => !TEST_PATH.test(path)).map(stem));
  const candidates = repositoryTests.filter((path) => changedSourceStems.has(stem(path))).slice(0, 50);
  const testedStems = new Set([...changed, ...candidates].map(stem));
  const unverifiedAreas = changedPaths.filter((path) => !TEST_PATH.test(path) && !testedStems.has(stem(path))).slice(0, 50);
  return {
    tests: { changed, candidates, unverifiedAreas },
    capability: {
      collector: "test-signals",
      status: "available",
      details: `Convention-based changed and nearby test paths from ${snapshot === void 0 ? "the working tree" : "the selected head"}; no test-quality judgment.`,
      limits: {
        maxCandidateTests: 50,
        maxUnverifiedAreas: 50,
        snapshot: snapshot === void 0 ? "working-tree" : "selected-head"
      }
    }
  };
}

// src/git/scope.ts
import { lstat, readFile as readFile2, realpath as realpath2 } from "node:fs/promises";
import { isAbsolute as isAbsolute2, relative as relative2, resolve as resolve2, sep as sep2 } from "node:path";

// src/git/diff.ts
function stripPrefix(path) {
  const unquoted = path.startsWith('"') && path.endsWith('"') ? path.slice(1, -1) : path;
  if (unquoted === "/dev/null") {
    return unquoted;
  }
  return unquoted.replace(/^[ab]\//, "").replaceAll("\\", "/");
}
function parseRange(start, count) {
  return {
    start: Number(start),
    count: count === void 0 ? 1 : Number(count)
  };
}
function parseUnifiedDiff(patch) {
  const lines = patch.replaceAll("\r\n", "\n").split("\n");
  const hunks = [];
  let file = null;
  let index = 0;
  const finalizeFile = () => {
    if (file?.path === null || file === null || file.hunkCount > 0) {
      return;
    }
    if (file.editKind !== "renamed" && !file.binary) {
      return;
    }
    const path = file.path;
    hunks.push({
      id: `${path}:1:1:${index++}`,
      path,
      header: file.binary ? "binary change" : `rename from ${file.previousPath ?? path}`,
      oldRange: { start: 1, count: 0 },
      newRange: { start: 1, count: 0 },
      location: { path, side: "current", start: 1, end: 1, deleted: false },
      lines: [],
      editKind: file.editKind,
      binary: file.binary,
      generated: false
    });
  };
  for (let cursor = 0; cursor < lines.length; cursor += 1) {
    const line = lines[cursor] ?? "";
    if (line.startsWith("diff --git ")) {
      finalizeFile();
      file = {
        path: null,
        previousPath: null,
        editKind: "modified",
        binary: false,
        hunkCount: 0
      };
      continue;
    }
    if (file === null) {
      continue;
    }
    if (line.startsWith("new file mode ")) {
      file.editKind = "added";
      continue;
    }
    if (line.startsWith("deleted file mode ")) {
      file.editKind = "deleted";
      continue;
    }
    if (line.startsWith("rename from ")) {
      file.previousPath = stripPrefix(line.slice("rename from ".length));
      file.editKind = "renamed";
      continue;
    }
    if (line.startsWith("rename to ")) {
      file.path = stripPrefix(line.slice("rename to ".length));
      file.editKind = "renamed";
      continue;
    }
    if (line.startsWith("--- ")) {
      const oldPath = stripPrefix(line.slice(4).split("	", 1)[0] ?? "");
      if (oldPath !== "/dev/null") {
        file.previousPath = oldPath;
        if (file.path === null) {
          file.path = oldPath;
        }
      }
      continue;
    }
    if (line.startsWith("+++ ")) {
      const newPath = stripPrefix(line.slice(4).split("	", 1)[0] ?? "");
      if (newPath !== "/dev/null") {
        file.path = newPath;
      }
      continue;
    }
    if (line.startsWith("Binary files ") || line.startsWith("GIT binary patch")) {
      file.binary = true;
      continue;
    }
    if (!line.startsWith("@@ ")) {
      continue;
    }
    const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (match === null || file.path === null) {
      continue;
    }
    const oldRange = parseRange(match[1] ?? "0", match[2]);
    const newRange = parseRange(match[3] ?? "0", match[4]);
    const changedLines = [];
    let oldLine = oldRange.start;
    let newLine = newRange.start;
    let inner = cursor + 1;
    for (; inner < lines.length; inner += 1) {
      const contentLine = lines[inner] ?? "";
      if (contentLine.startsWith("diff --git ") || contentLine.startsWith("@@ ")) {
        break;
      }
      if (contentLine.startsWith("+") && !contentLine.startsWith("+++")) {
        changedLines.push({
          kind: "add",
          oldLine: null,
          newLine,
          content: contentLine.slice(1)
        });
        newLine += 1;
      } else if (contentLine.startsWith("-") && !contentLine.startsWith("---")) {
        changedLines.push({
          kind: "delete",
          oldLine,
          newLine: null,
          content: contentLine.slice(1)
        });
        oldLine += 1;
      } else if (contentLine.startsWith(" ")) {
        changedLines.push({
          kind: "context",
          oldLine,
          newLine,
          content: contentLine.slice(1)
        });
        oldLine += 1;
        newLine += 1;
      } else if (!contentLine.startsWith("\\")) {
        break;
      }
    }
    const deleted = file.editKind === "deleted" || newRange.count === 0 && file.editKind !== "added";
    const locationRange = deleted ? oldRange : newRange;
    const locationStart = Math.max(1, locationRange.start);
    const locationEnd = Math.max(locationStart, locationRange.start + Math.max(1, locationRange.count) - 1);
    const path = file.path;
    hunks.push({
      id: `${path}:${newRange.start}:${oldRange.start}:${index++}`,
      path,
      header: line,
      oldRange,
      newRange,
      location: {
        path,
        side: deleted ? "old" : "current",
        start: locationStart,
        end: locationEnd,
        deleted
      },
      lines: changedLines,
      editKind: file.editKind,
      binary: file.binary,
      generated: false
    });
    file.hunkCount += 1;
    cursor = inner - 1;
  }
  finalizeFile();
  return hunks;
}

// src/git/scope.ts
var MAX_UNTRACKED_BYTES = 256 * 1024;
var ScopeResolutionError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "ScopeResolutionError";
  }
};
async function repositoryRoot(input) {
  const resolvedInput = await realpath2(resolve2(input));
  try {
    const result = await runGit(resolvedInput, ["rev-parse", "--show-toplevel"]);
    return await realpath2(result.stdout.trim());
  } catch (error) {
    throw new ScopeResolutionError(`Not a Git repository: ${error instanceof Error ? error.message : String(error)}`);
  }
}
function assertContained(root, target) {
  const pathFromRoot = relative2(root, target);
  if (pathFromRoot === ".." || pathFromRoot.startsWith(`..${sep2}`) || isAbsolute2(pathFromRoot)) {
    throw new ScopeResolutionError(`Resolved path leaves the repository: ${target}`);
  }
}
async function resolveHead(root) {
  try {
    return (await runGit(root, ["rev-parse", "--verify", "HEAD"])).stdout.trim();
  } catch {
    return null;
  }
}
function synthesizeNewFilePatch(path, content) {
  const normalized = content.replaceAll("\r\n", "\n");
  const contentLines = normalized.endsWith("\n") ? normalized.slice(0, -1).split("\n") : normalized.split("\n");
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
function synthesizeBinaryHunk(path) {
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
      deleted: false
    },
    lines: [],
    editKind: "added",
    binary: true,
    generated: false
  };
}
async function collectUntracked(root) {
  const result = await runGit(root, ["ls-files", "--others", "--exclude-standard", "-z"]);
  const paths = result.stdout.split("\0").filter(Boolean).sort();
  const hunks = [];
  const binaryFiles = [];
  const warnings = [];
  for (const path of paths) {
    if (path.includes("\n") || path.includes("\r")) {
      warnings.push(`Skipped untracked path with a line break: ${JSON.stringify(path)}`);
      continue;
    }
    const target = resolve2(root, ...path.split("/"));
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
    const buffer = await readFile2(target);
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
function stableHunks(hunks) {
  const unique = /* @__PURE__ */ new Map();
  for (const hunk of hunks) {
    const key = `${hunk.path}\0${hunk.oldRange.start}\0${hunk.newRange.start}\0${hunk.header}`;
    unique.set(key, hunk);
  }
  return [...unique.values()].sort(
    (left, right) => left.path.localeCompare(right.path) || left.location.start - right.location.start || left.id.localeCompare(right.id)
  );
}
async function resolveWorkingChange(input, options = {}) {
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
    "--"
  ], options.maxDiffOutputBytes === void 0 ? {} : { maxOutputBytes: options.maxDiffOutputBytes });
  const status = await runGit(root, ["status", "--porcelain=v1", "-uno"]);
  const untracked = await collectUntracked(root);
  const trackedHunks = parseUnifiedDiff(diff.stdout);
  const binaryFiles = [
    ...trackedHunks.filter((hunk) => hunk.binary).map((hunk) => hunk.path),
    ...untracked.binaryFiles
  ].sort();
  const scope = { kind: "working", headObject };
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
      ...diff.truncated ? ["Git diff output was truncated at the configured byte bound."] : []
    ]
  };
}
function validateRevision(revision, label) {
  if (revision.length === 0 || revision.startsWith("-") || /[\0\r\n]/u.test(revision)) {
    throw new ScopeResolutionError(`Invalid ${label} revision`);
  }
}
async function resolveCommit(root, revision, label) {
  validateRevision(revision, label);
  try {
    const result = await runGit(root, ["rev-parse", "--verify", "--end-of-options", `${revision}^{commit}`]);
    return result.stdout.trim();
  } catch (error) {
    const detail = error instanceof ProcessExecutionError ? error.stderr.trim() : String(error);
    throw new ScopeResolutionError(`Could not resolve ${label} revision ${JSON.stringify(revision)}${detail ? `: ${detail}` : ""}`);
  }
}
async function resolveRevisionRange(input, baseInput, headInput, options = {}) {
  const root = await repositoryRoot(input);
  const baseObject = await resolveCommit(root, baseInput, "base");
  const headObject = await resolveCommit(root, headInput, "head");
  let mergeBaseObject;
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
    "--"
  ], options.maxDiffOutputBytes === void 0 ? {} : { maxOutputBytes: options.maxDiffOutputBytes });
  const hunks = parseUnifiedDiff(diff.stdout);
  const scope = {
    kind: "range",
    baseInput,
    headInput,
    baseObject,
    headObject,
    mergeBaseObject
  };
  return {
    scope,
    repositoryRoot: root.replaceAll("\\", "/"),
    headObject,
    dirty: false,
    hunks: stableHunks(hunks),
    binaryFiles: hunks.filter((hunk) => hunk.binary).map((hunk) => hunk.path).sort(),
    diffTruncated: diff.truncated,
    warnings: diff.truncated ? ["Git diff output was truncated at the configured byte bound."] : []
  };
}

// src/ranking/rank.ts
var BAND_ORDER = {
  elevated: 0,
  notable: 1,
  context: 2
};
var REASON_PRECEDENCE = {
  SMALL_HUNK_BROAD_REACH: 10,
  SENSITIVE_SHARED_PATH: 20,
  BROAD_TEXTUAL_REACH: 30,
  CONTROL_FLOW_CHANGE: 40,
  PUBLIC_SURFACE_CHANGE: 50,
  SENSITIVE_FILE_ROLE: 60,
  NO_TEST_CHANGE: 70,
  GENERATED_FILE: 90
};
function numericFact(facts, code) {
  const values = facts.filter((fact) => fact.reasonCode === code).map((fact) => {
    if (typeof fact.value === "object" && fact.value !== null && "count" in fact.value) {
      const count = fact.value.count;
      return typeof count === "number" ? count : 0;
    }
    return 0;
  });
  return Math.max(0, ...values);
}
function roles(facts) {
  return facts.flatMap((fact) => {
    if (fact.reasonCode !== "FILE_ROLE" || typeof fact.value !== "object" || fact.value === null) {
      return [];
    }
    const value = fact.value.roles;
    return Array.isArray(value) ? value.filter((role) => typeof role === "string") : [];
  });
}
function rankCandidates(hunks, facts, testsChanged) {
  const candidates = hunks.map((hunk) => {
    const hunkFacts = facts.filter((fact) => fact.hunkId === hunk.id);
    const textualBreadth = numericFact(hunkFacts, "TEXTUAL_REFERENCE_BREADTH");
    const importBreadth = numericFact(hunkFacts, "IMPORT_REFERENCE_BREADTH");
    const changedLineCount = hunk.lines.filter((line) => line.kind !== "context").length;
    const hunkRoles = roles(hunkFacts);
    const hasControl = hunkFacts.some((fact) => fact.reasonCode === "CONTROL_FLOW_TOKEN");
    const hasPublicSurface = hunkFacts.some((fact) => fact.reasonCode === "PUBLIC_SURFACE_TOKEN");
    const documentation = hunkRoles.includes("documentation");
    const sensitive = hunkRoles.some(
      (role) => ["auth-policy", "configuration", "migration", "routing", "shared-core"].includes(role)
    );
    const generated = hunk.generated || hunkFacts.some((fact) => fact.reasonCode === "GENERATED_FILE");
    const broadReach = textualBreadth >= 5 || importBreadth >= 3;
    const reasons = [];
    let band = "context";
    if (hunk.binary) {
      reasons.push("BINARY_CHANGE");
    }
    if (changedLineCount <= 10 && broadReach && !generated && !hunk.binary && !documentation) {
      reasons.push("SMALL_HUNK_BROAD_REACH");
      band = "elevated";
    }
    if (sensitive && broadReach && !generated && !hunk.binary && !documentation) {
      reasons.push("SENSITIVE_SHARED_PATH");
      band = "elevated";
    }
    if (textualBreadth >= 3 || importBreadth >= 2) {
      reasons.push("BROAD_TEXTUAL_REACH");
      if (band === "context" && !documentation) {
        band = "notable";
      }
    }
    if (hasControl) {
      reasons.push("CONTROL_FLOW_CHANGE");
      if (band === "context" && sensitive && !documentation) {
        band = "notable";
      }
    }
    if (hasPublicSurface) {
      reasons.push("PUBLIC_SURFACE_CHANGE");
      if (band === "context" && !documentation) {
        band = "notable";
      }
    }
    if (sensitive) {
      reasons.push("SENSITIVE_FILE_ROLE");
      if (band === "context" && !documentation) {
        band = "notable";
      }
    }
    if (!testsChanged && band !== "context") {
      reasons.push("NO_TEST_CHANGE");
    }
    if (generated) {
      reasons.push("GENERATED_FILE");
      if (band === "elevated") {
        band = "notable";
      } else if (!broadReach) {
        band = "context";
      }
    }
    const uniqueReasons = [...new Set(reasons)];
    const precedence = Math.min(100, ...uniqueReasons.map((reason) => REASON_PRECEDENCE[reason] ?? 80));
    return {
      hunkId: hunk.id,
      location: hunk.location,
      band,
      reasons: uniqueReasons,
      tieBreak: {
        precedence,
        path: hunk.path,
        line: hunk.location.start
      }
    };
  });
  return candidates.sort(
    (left, right) => BAND_ORDER[left.band] - BAND_ORDER[right.band] || left.tieBreak.precedence - right.tieBreak.precedence || left.tieBreak.path.localeCompare(right.tieBreak.path) || left.tieBreak.line - right.tieBreak.line || left.hunkId.localeCompare(right.hunkId)
  );
}

// src/analyze.ts
function summarizeChangedFiles(hunks) {
  const files = /* @__PURE__ */ new Map();
  for (const hunk of hunks) {
    const current = files.get(hunk.path);
    if (current === void 0) {
      files.set(hunk.path, {
        path: hunk.path,
        editKind: hunk.editKind,
        binary: hunk.binary,
        hunkCount: 1
      });
    } else {
      current.hunkCount += 1;
      current.binary ||= hunk.binary;
    }
  }
  return [...files.values()].sort((left, right) => left.path.localeCompare(right.path));
}
async function analyzeChange(options) {
  const resolved = options.scope.kind === "working" ? await resolveWorkingChange(options.repository) : await resolveRevisionRange(options.repository, options.scope.base, options.scope.head);
  const fileSignals = collectFileSignalFacts(resolved.hunks);
  const snapshot = resolved.scope.kind === "range" ? resolved.scope.headObject : void 0;
  const [references, history, testSignals] = await Promise.all([
    collectReferenceFacts(
      resolved.repositoryRoot,
      fileSignals.hunks,
      {
        rgCommand: options.collectorOptions?.rgCommand,
        snapshot
      }
    ),
    collectHistoryFacts(resolved.repositoryRoot, fileSignals.hunks, resolved.headObject ?? "HEAD"),
    collectTestSignals(resolved.repositoryRoot, fileSignals.hunks, snapshot)
  ]);
  const facts = [...fileSignals.facts, ...references.facts, ...history.facts].sort(
    (left, right) => left.hunkId.localeCompare(right.hunkId) || left.id.localeCompare(right.id)
  );
  const capabilities = [
    {
      collector: "git-scope",
      status: resolved.diffTruncated ? "partial" : "available",
      details: "Git diff collected with external diff and text conversion disabled.",
      limits: { maxUntrackedFileBytes: 256 * 1024, diffTruncated: resolved.diffTruncated }
    },
    {
      collector: "file-signals",
      status: "available",
      details: "Conservative path roles and changed-token patterns.",
      limits: {}
    },
    references.capability,
    history.capability,
    testSignals.capability,
    {
      collector: "language-intelligence",
      status: "unavailable",
      details: "No semantic dependency graph was supplied; downstream reach remains partial.",
      limits: {}
    }
  ].sort((left, right) => left.collector.localeCompare(right.collector));
  const candidates = rankCandidates(fileSignals.hunks, facts, testSignals.tests.changed.length > 0);
  const warnings = [...resolved.warnings, ...references.warnings, ...history.warnings];
  if (fileSignals.hunks.length === 0) {
    warnings.push("No changed hunks were found in the selected scope.");
  }
  const envelope = {
    schemaVersion: "1",
    scope: resolved.scope,
    repository: {
      root: resolved.repositoryRoot,
      headObject: resolved.headObject,
      dirty: resolved.dirty
    },
    capabilities,
    changedFiles: summarizeChangedFiles(fileSignals.hunks),
    facts,
    candidates,
    tests: testSignals.tests,
    warnings: [...new Set(warnings)].sort()
  };
  return assertEvidenceEnvelopeV1(envelope);
}

// src/internal-entry.ts
function usage() {
  return "Usage: analyze.mjs [--repo <path>] [--base <revision> --head <revision>] [--pretty]";
}
function parseArguments(args) {
  let repository = process2.cwd();
  let base;
  let head;
  let pretty = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--pretty") {
      pretty = true;
      continue;
    }
    if (argument === "--repo" || argument === "--base" || argument === "--head") {
      const value = args[index + 1];
      if (value === void 0) {
        throw new Error(`${argument} requires a value`);
      }
      index += 1;
      if (argument === "--repo") {
        repository = value;
      } else if (argument === "--base") {
        base = value;
      } else {
        head = value;
      }
      continue;
    }
    if (argument === "--help") {
      process2.stdout.write(`${usage()}
`);
      process2.exit(0);
    }
    throw new Error(`Unknown argument: ${argument}`);
  }
  if (base === void 0 !== (head === void 0)) {
    throw new Error("--base and --head must be provided together");
  }
  return {
    repository: resolve3(repository),
    scope: base !== void 0 && head !== void 0 ? { kind: "range", base, head } : { kind: "working" },
    pretty
  };
}
async function main() {
  const parsed = parseArguments(process2.argv.slice(2));
  const envelope = await analyzeChange({
    repository: parsed.repository,
    scope: parsed.scope
  });
  const serialized = parsed.pretty ? JSON.stringify(envelope, null, 2) : stableSerialize(envelope);
  process2.stdout.write(`${serialized}
`);
}
try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process2.stderr.write(
    `${JSON.stringify({
      error: {
        name: error instanceof Error ? error.name : "Error",
        message
      }
    })}
`
  );
  process2.exitCode = 1;
}
