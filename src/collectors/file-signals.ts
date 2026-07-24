import { basename, extname } from "node:path";
import type { ChangedHunk, EvidenceFact } from "../contracts/evidence.js";

const CONTROL_TOKENS = /\b(if|else|switch|case|return|throw|catch|finally|break|continue|await|yield)\b|&&|\|\||\?\?/gu;
const PUBLIC_TOKENS =
  /\b(export|public|protected|interface|type|class|def|function|func|module|package|route|handler|endpoint)\b/gu;

function normalizedPath(path: string): string {
  return `/${path.toLowerCase().replaceAll("\\", "/")}`;
}

export function classifyPath(path: string): { generated: boolean; roles: string[] } {
  const normalized = normalizedPath(path);
  const filename = basename(normalized);
  const extension = extname(filename);
  const roles: string[] = [];
  const generated =
    /\/(generated|gen|dist|build|coverage|vendor|node_modules)\//u.test(normalized) ||
    /\.(generated|g|min)\.[^.]+$/u.test(filename) ||
    /(?:^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|cargo\.lock|composer\.lock)$/u.test(normalized);

  if (/\/(core|shared|common|kernel|platform|infrastructure)\//u.test(normalized)) {
    roles.push("shared-core");
  }
  if (/\/(auth|authorization|permissions?|policies?)\//u.test(normalized) || /(auth|policy|permission)/u.test(filename)) {
    roles.push("auth-policy");
  }
  if (/\/(routes?|routing)\//u.test(normalized) || /(route|router)/u.test(filename)) {
    roles.push("routing");
  }
  if (
    /\/(config|configuration)\//u.test(normalized) ||
    [".json", ".yaml", ".yml", ".toml", ".ini"].includes(extension) ||
    /(?:^|\/)(dockerfile|makefile)$/u.test(normalized)
  ) {
    roles.push("configuration");
  }
  if (/\/(migrations?|schema)\//u.test(normalized) || /(migration|schema)/u.test(filename)) {
    roles.push("migration");
  }
  if (/(^|\/)(tests?|spec|__tests__)\//u.test(normalized) || /\.(test|spec)\.[^.]+$/u.test(filename)) {
    roles.push("test");
  }

  return { generated, roles: [...new Set(roles)].sort() };
}

function changedText(hunk: ChangedHunk): string {
  return hunk.lines
    .filter((line) => line.kind === "add" || line.kind === "delete")
    .map((line) => line.content)
    .join("\n");
}

export function collectFileSignalFacts(hunks: readonly ChangedHunk[]): {
  hunks: ChangedHunk[];
  facts: EvidenceFact[];
} {
  const facts: EvidenceFact[] = [];
  const classifiedHunks = hunks.map((input): ChangedHunk => {
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
        value: { roles: classification.roles },
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
        value: { generated: true },
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
        value: { binary: true },
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
        value: { tokens: [...new Set(controlTokens)].sort() },
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
        value: { tokens: [...new Set(publicTokens)].sort() },
      });
    }
    return hunk;
  });

  return { hunks: classifiedHunks, facts };
}
