import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");

async function readJson(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(resolve(root, path), "utf8")) as Record<string, unknown>;
}

describe("plugin layout", () => {
  it("keeps host identity and the canonical skill path in sync", async () => {
    const [codex, claude, packageJson] = await Promise.all([
      readJson(".codex-plugin/plugin.json"),
      readJson(".claude-plugin/plugin.json"),
      readJson("package.json"),
    ]);

    for (const field of ["name", "version", "description", "repository", "license"]) {
      expect(codex[field]).toEqual(claude[field]);
    }

    expect(codex.name).toBe(packageJson.name);
    expect(codex.version).toBe(packageJson.version);
    expect(codex.skills).toBe("./skills/");
    expect(claude.skills).toBe("./skills/");
    await expect(readFile(resolve(root, "skills/review/SKILL.md"), "utf8")).resolves.toContain("name: review");
  });

  it("keeps report restraint and bounded-analysis wording developer-facing", async () => {
    const contract = await readFile(
      resolve(root, "skills/review/references/report-contract.md"),
      "utf8",
    );

    expect(contract).toContain(
      "No other changed location had enough evidence for a specific hidden-impact finding.",
    );
    expect(contract).toContain(
      "Analysis was bounded; N lower-priority candidates were not investigated by the model.",
    );
    expect(contract).toMatch(/Do not repeat raw .*omittedFacts/u);
  });
});
