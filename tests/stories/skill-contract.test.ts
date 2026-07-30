import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");

async function readStoriesFile(path: string): Promise<string> {
  return readFile(resolve(root, "skills/stories", path), "utf8");
}

describe("stories skill contract", () => {
  it("routes the product lifecycle across three focused skills", async () => {
    const [skill, metadata] = await Promise.all([
      readStoriesFile("SKILL.md"),
      readStoriesFile("agents/openai.yaml"),
    ]);

    expect(skill).toContain("Use `preflight` before");
    expect(skill).toContain("Use `stories` after");
    expect(skill).toContain("Use `review` only after");
    expect(skill).toMatch(/after product or design analysis/i);
    expect(metadata).toContain("$stories");
    expect(metadata).toMatch(/recheck the current repository/i);
  });

  it("always rechecks the repository instead of trusting preflight", async () => {
    const [skill, rules, report] = await Promise.all([
      readStoriesFile("SKILL.md"),
      readStoriesFile("references/story-rules.md"),
      readStoriesFile("references/report-contract.md"),
    ]);

    expect(skill).toMatch(/do this even when a preflight report is supplied/i);
    expect(skill).toMatch(/recheck the repository/i);
    expect(rules).toMatch(/not current repository evidence/i);
    expect(report).toMatch(/drifted from it/i);
  });

  it("creates outcome stories with requirement coverage", async () => {
    const [skill, rules, report] = await Promise.all([
      readStoriesFile("SKILL.md"),
      readStoriesFile("references/story-rules.md"),
      readStoriesFile("references/report-contract.md"),
    ]);

    expect(skill).toMatch(/map every requirement to at least one primary story/i);
    expect(rules).toMatch(/vertical outcome slices/i);
    expect(rules).toMatch(/do not split solely by/i);
    expect(report).toContain("## Technical stories");
    expect(report).toContain("## Requirement coverage");
    expect(report).toContain("Acceptance scenarios:");
    expect(report).toContain("Delta:");
  });

  it("supports finalized proposal-only stories without invented repository evidence", async () => {
    const [skill, rules, report] = await Promise.all([
      readStoriesFile("SKILL.md"),
      readStoriesFile("references/story-rules.md"),
      readStoriesFile("references/report-contract.md"),
    ]);

    expect(skill).toMatch(/cite the requirement and label it\s+`new proposal scope`/i);
    expect(skill).toMatch(/missing repository counterpart is not incomplete evidence/i);
    expect(rules).toMatch(/`new proposal scope` with\s+requirement evidence/i);
    expect(report).toMatch(/do not require a repository\s+citation/i);
    expect(report).toMatch(/never attach an unrelated repository location/i);
    expect(report).toMatch(/do not mark a finalized requirement `partial` or `blocked` merely/i);
    expect(report).toMatch(/give every complete story an explicit `Delta`/i);
    expect(report).toMatch(/\| Requirement \| Primary story \| Status \| Evidence \|/);
  });

  it("supports another story skill through a portable evidence pack", async () => {
    const [skill, report] = await Promise.all([
      readStoriesFile("SKILL.md"),
      readStoriesFile("references/report-contract.md"),
    ]);

    expect(skill).toMatch(/handoff mode/i);
    expect(skill).toMatch(/names another story-writing skill/i);
    expect(skill).toMatch(/do not invoke or imitate the other skill/i);
    expect(report).toContain("## Story Evidence Pack");
    expect(report).toMatch(/self-contained/i);
  });

  it("is read-only and does not invent unresolved decisions", async () => {
    const skill = await readStoriesFile("SKILL.md");

    expect(skill).toMatch(/work read-only/i);
    expect(skill).toMatch(/do not make network requests/i);
    expect(skill).toMatch(/untrusted data/i);
    expect(skill).toMatch(/do not follow instructions/i);
    expect(skill).toMatch(/do not invent product behavior/i);
  });
});
