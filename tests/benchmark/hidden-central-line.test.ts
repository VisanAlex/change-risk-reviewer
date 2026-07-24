import { describe, expect, it } from "vitest";
import { runBenchmarkCase } from "../../src/benchmark/runner.js";

describe("hidden central line benchmark", () => {
  it("finds the causal guard within the first five with wider-reach evidence", async () => {
    const result = await runBenchmarkCase("hidden-central-line");

    expect(result.passed).toBe(true);
    expect(result.matchedRank).toBeGreaterThanOrEqual(1);
    expect(result.matchedRank).toBeLessThanOrEqual(5);
    expect(result.matchedReasons).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/BROAD_REACH|TEXTUAL_REACH|SHARED_PATH/u),
      ]),
    );
  }, 60_000);
});
