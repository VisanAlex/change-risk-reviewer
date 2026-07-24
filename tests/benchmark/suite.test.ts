import { describe, expect, it } from "vitest";
import { runBenchmarkSuite } from "../../src/benchmark/runner.js";

describe("benchmark suite", () => {
  it("passes every public case against its post-run oracle", async () => {
    const results = await runBenchmarkSuite();

    expect(results.map((result) => result.caseId)).toEqual([
      "hidden-central-line",
      "isolated-change",
      "large-generated-volume",
      "missing-structure",
    ]);
    expect(results.every((result) => result.passed)).toBe(true);
  }, 120_000);
});
