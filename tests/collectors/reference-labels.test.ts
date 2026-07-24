import { describe, expect, it } from "vitest";
import { analyzeChange } from "../../src/analyze.js";
import { createRepository, writeRepositoryFile } from "../helpers/git.js";

describe("textual reference evidence", () => {
  it("labels occurrences as textual/import evidence rather than call sites", async () => {
    const files: Record<string, string> = {
      "src/core/dispatch.ts": "export function dispatch() { return true; }\n",
    };
    for (let index = 0; index < 8; index += 1) {
      files[`src/features/consumer-${index}.ts`] =
        `import { dispatch } from "../core/dispatch";\nexport const feature${index} = dispatch();\n`;
    }
    const repository = await createRepository(files);
    await writeRepositoryFile(
      repository,
      "src/core/dispatch.ts",
      "export function dispatch() { if (enabled) return false; return true; }\n",
    );

    const envelope = await analyzeChange({ repository, scope: { kind: "working" } });
    const facts = envelope.facts.filter((fact) => fact.hunkId === envelope.candidates[0]?.hunkId);

    expect(facts.some((fact) => fact.reasonCode === "TEXTUAL_REFERENCE_BREADTH")).toBe(true);
    expect(facts.some((fact) => fact.reasonCode === "IMPORT_REFERENCE_BREADTH")).toBe(true);
    expect(JSON.stringify(facts).toLowerCase()).not.toContain("call site");
    expect(envelope.candidates[0]?.band).toBe("elevated");
  });

  it("does not promote comment-only ambiguous identifiers to import evidence", async () => {
    const repository = await createRepository({
      "src/local.ts": "const run = 1;\n",
      "src/notes.ts": "// run should stay documented\n",
    });
    await writeRepositoryFile(repository, "src/local.ts", "const run = 2;\n");

    const envelope = await analyzeChange({ repository, scope: { kind: "working" } });
    const importFacts = envelope.facts.filter((fact) => fact.reasonCode === "IMPORT_REFERENCE_BREADTH");

    expect(importFacts.every((fact) => (fact.value as { count: number }).count === 0)).toBe(true);
  });
});
