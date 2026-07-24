import { describe, expect, it } from "vitest";
import { analyzeChange } from "../../src/analyze.js";
import { createRepository, writeRepositoryFile } from "../helpers/git.js";

describe("test change signals", () => {
  it("distinguishes changed tests from nearby candidate tests", async () => {
    const repository = await createRepository({
      "src/service.ts": "export const service = 1;\n",
      "tests/service.test.ts": "test('service', () => {});\n",
    });
    await writeRepositoryFile(repository, "src/service.ts", "export const service = 2;\n");

    const withoutTestChange = await analyzeChange({ repository, scope: { kind: "working" } });
    expect(withoutTestChange.tests.changed).toEqual([]);
    expect(withoutTestChange.tests.candidates).toContain("tests/service.test.ts");

    await writeRepositoryFile(repository, "tests/service.test.ts", "test('service changed', () => {});\n");
    const withTestChange = await analyzeChange({ repository, scope: { kind: "working" } });
    expect(withTestChange.tests.changed).toContain("tests/service.test.ts");
  });
});
