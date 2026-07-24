import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface PackEntry {
  files: Array<{ path: string }>;
}

async function dryRunPack(): Promise<PackEntry> {
  const repository = resolve(import.meta.dirname, "../..");
  const npmEntry = process.env.npm_execpath;
  if (npmEntry === undefined) {
    throw new Error("npm_execpath is unavailable");
  }
  const output = await new Promise<string>((resolveOutput, reject) => {
    const child = spawn(process.execPath, [npmEntry, "pack", "--json", "--dry-run", "--ignore-scripts"], {
      cwd: repository,
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
    child.on("close", (code) => {
      if (code === 0) {
        resolveOutput(stdout);
      } else {
        reject(new Error(`npm pack failed: ${stderr}`));
      }
    });
  });
  const parsed = JSON.parse(output) as unknown;
  if (!Array.isArray(parsed) || parsed.length !== 1) {
    throw new Error("npm pack did not return one package description");
  }
  return parsed[0] as PackEntry;
}

describe("release archive", () => {
  it("contains the self-contained plugin surface and excludes development clutter", async () => {
    const entry = await dryRunPack();
    const files = entry.files.map((file) => file.path);

    expect(files).toContain(".codex-plugin/plugin.json");
    expect(files).toContain(".claude-plugin/plugin.json");
    expect(files).toContain(".agents/plugins/marketplace.json");
    expect(files).toContain("skills/review/SKILL.md");
    expect(files).toContain("skills/review/scripts/analyze.mjs");
    expect(files).toContain("LICENSE");
    expect(files).toContain("README.md");
    expect(files.some((path) => path.startsWith("src/"))).toBe(false);
    expect(files.some((path) => path.startsWith("tests/"))).toBe(false);
    expect(files.some((path) => path.startsWith("node_modules/"))).toBe(false);
  });
});
