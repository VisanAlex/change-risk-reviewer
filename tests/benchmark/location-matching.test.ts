import { describe, expect, it } from "vitest";
import { locationMatchesOracle } from "../../src/benchmark/runner.js";

describe("oracle location matching", () => {
  it("accepts overlapping movement and rejects a different same-file hunk", () => {
    const expected = { path: "src/value.ts", side: "current" as const, start: 10, end: 12 };

    expect(
      locationMatchesOracle(
        { path: "src/value.ts", side: "current", start: 11, end: 11, deleted: false },
        expected,
      ),
    ).toBe(true);
    expect(
      locationMatchesOracle(
        { path: "src/value.ts", side: "current", start: 30, end: 31, deleted: false },
        expected,
      ),
    ).toBe(false);
  });

  it("matches deletion ranges only on the old side", () => {
    const expected = { path: "src/old.ts", side: "old" as const, start: 4, end: 5 };

    expect(
      locationMatchesOracle(
        { path: "src/old.ts", side: "old", start: 4, end: 5, deleted: true },
        expected,
      ),
    ).toBe(true);
    expect(
      locationMatchesOracle(
        { path: "src/old.ts", side: "current", start: 4, end: 5, deleted: false },
        expected,
      ),
    ).toBe(false);
  });
});
