import { describe, expect, it } from "vitest";
import { runBenchmarkCase } from "../../src/benchmark/runner.js";

describe("restraint benchmark", () => {
  it("does not manufacture elevated findings for an isolated tested change", async () => {
    const result = await runBenchmarkCase("isolated-change");

    expect(result.passed).toBe(true);
    expect(result.capture.candidates.filter((candidate) => candidate.band === "elevated")).toHaveLength(0);
    expect(result.capture.candidates).toHaveLength(2);
  }, 30_000);
});
