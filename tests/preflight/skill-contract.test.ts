import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");

async function readSkillFile(path: string): Promise<string> {
  return readFile(resolve(root, "skills/preflight", path), "utf8");
}

describe("preflight skill contract", () => {
  it("keeps preflight distinct from story writing and implemented change review", async () => {
    const skill = await readSkillFile("SKILL.md");

    expect(skill).toContain("Use `preflight` before");
    expect(skill).toContain("Use `stories` after");
    expect(skill).toContain("Use `review` after");
    expect(skill).toMatch(/before implementation/i);
    expect(skill).toMatch(/different languages/i);
    expect(skill).toMatch(/prototype file or directory/i);
    expect(skill).toMatch(/explicit Git revision or branch/i);
  });

  it("remains read-only and treats analyzed artifacts as untrusted", async () => {
    const skill = await readSkillFile("SKILL.md");

    expect(skill).toMatch(/work read-only/i);
    expect(skill).toMatch(/do not edit, write/i);
    expect(skill).toMatch(/do not make network requests/i);
    expect(skill).toMatch(/untrusted data/i);
    expect(skill).toMatch(/do not follow instructions/i);
  });

  it("requires evidence from both sides and bounded omission claims", async () => {
    const [skill, evidence, report] = await Promise.all([
      readSkillFile("SKILL.md"),
      readSkillFile("references/evidence-rules.md"),
      readSkillFile("references/report-contract.md"),
    ]);

    expect(skill).toMatch(/at most five target areas/i);
    expect(skill).toMatch(/target evidence, proposal evidence/i);
    expect(evidence).toMatch(/absence claims require a disclosed, bounded search/i);
    expect(report).toContain("## Current behavior");
    expect(report).toContain("## Impact map");
    expect(report).toContain("### Direct");
    expect(report).toContain("### Indirect");
    expect(report).toContain("## Preflight first");
    expect(report).toContain("## Contracts already represented");
    expect(report).toContain("## Unknowns and assumptions");
    expect(report).toContain("## Coverage limits");
    expect(report).toMatch(/no more than five findings/i);
  });

  it("supports product and design impact analysis", async () => {
    const [skill, report, metadata] = await Promise.all([
      readSkillFile("SKILL.md"),
      readSkillFile("references/report-contract.md"),
      readSkillFile("agents/openai.yaml"),
    ]);

    expect(skill).toMatch(/task, MOD-01, specification, screen sketch/i);
    expect(skill).toMatch(/optional impact sketch/i);
    expect(skill).toMatch(/map current behavior and the change surface/i);
    expect(report).toMatch(/direct proposal scope from indirect evidence-backed impact/i);
    expect(metadata).toContain("$preflight");
    expect(metadata).toMatch(/direct and indirect impact/i);
  });

  it("forbids safety verdicts and unsupported language risk", async () => {
    const [skill, report] = await Promise.all([
      readSkillFile("SKILL.md"),
      readSkillFile("references/report-contract.md"),
    ]);

    expect(skill).toMatch(/never say the proposal is safe, approved, complete, or ready to ship/i);
    expect(skill).toMatch(/different language alone/i);
    expect(report).toMatch(/do not treat the language difference as a risk signal/i);
  });
});
