import { readdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { buildBenchmarkFixture } from "../../src/benchmark/runner.js";

describe("benchmark oracle isolation", () => {
  it("does not copy the oracle into the reviewer workspace", async () => {
    const fixture = await buildBenchmarkFixture("hidden-central-line");
    try {
      const topLevel = await readdir(fixture.repository);
      expect(topLevel).not.toContain("benchmarks");
      expect(JSON.stringify(fixture.capture)).not.toContain("expectedLocations");
      expect(JSON.stringify(fixture.capture)).not.toContain("requiredAnyReasons");
    } finally {
      await fixture.cleanup();
    }
  }, 60_000);
});
