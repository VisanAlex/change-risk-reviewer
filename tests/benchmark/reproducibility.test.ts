import { describe, expect, it } from "vitest";
import { runBenchmarkCase } from "../../src/benchmark/runner.js";

describe("benchmark reproducibility", () => {
  it("produces the same normalized machine capture repeatedly", async () => {
    const first = await runBenchmarkCase("missing-structure");
    const second = await runBenchmarkCase("missing-structure");

    expect(second.fingerprint).toBe(first.fingerprint);
  }, 30_000);
});
