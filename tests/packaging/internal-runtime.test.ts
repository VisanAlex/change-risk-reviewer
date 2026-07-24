import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createRepository, writeRepositoryFile } from "../helpers/git.js";

async function runRuntime(args: string[]): Promise<{ code: number | null; stderr: string; stdout: string }> {
  const runtime = resolve(import.meta.dirname, "../../skills/review/scripts/analyze.mjs");
  return await new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, [runtime, ...args], {
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => resolveResult({ code, stderr, stdout }));
  });
}

describe("internal bundled runtime", () => {
  it("emits a compact V1 review input for a working change by default", async () => {
    const repository = await createRepository({ "src/value.ts": "export const value = 1;\n" });
    await writeRepositoryFile(repository, "src/value.ts", "export const value = 2;\n");

    const result = await runRuntime(["--repo", repository]);
    const explicitResult = await runRuntime(["--compact", "--repo", repository]);
    const input = JSON.parse(result.stdout) as {
      kind: string;
      schemaVersion: string;
      candidates: unknown[];
      selection: { selectedCandidates: number };
    };

    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
    expect(explicitResult).toEqual(result);
    expect(input.kind).toBe("change-risk-review-input");
    expect(input.schemaVersion).toBe("1");
    expect(input.candidates).toHaveLength(input.selection.selectedCandidates);
  });

  it("can emit the full evidence envelope for debugging", async () => {
    const repository = await createRepository({ "src/value.ts": "export const value = 1;\n" });
    await writeRepositoryFile(repository, "src/value.ts", "export const value = 2;\n");

    const result = await runRuntime(["--repo", repository, "--full"]);
    const envelope = JSON.parse(result.stdout) as {
      kind?: string;
      schemaVersion: string;
      candidates: unknown[];
      facts: Array<{ source?: unknown }>;
    };

    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
    expect(envelope.kind).toBeUndefined();
    expect(envelope.schemaVersion).toBe("1");
    expect(envelope.candidates).toHaveLength(1);
    expect(envelope.facts.every(({ source }) => source !== undefined)).toBe(true);
  });

  it("returns a structured error for an invalid named range", async () => {
    const repository = await createRepository();
    const result = await runRuntime(["--repo", repository, "--base", "--help", "--head", "HEAD"]);
    const errorPayload = JSON.parse(result.stderr) as unknown;
    const errorName =
      typeof errorPayload === "object" &&
      errorPayload !== null &&
      "error" in errorPayload &&
      typeof errorPayload.error === "object" &&
      errorPayload.error !== null &&
      "name" in errorPayload.error
        ? errorPayload.error.name
        : undefined;

    expect(result.code).toBe(1);
    expect(errorName).toBe("ScopeResolutionError");
  });
});
