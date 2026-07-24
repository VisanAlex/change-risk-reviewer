import { describe, expect, it } from "vitest";
import { validateReviewReport, type ReviewReport } from "../../src/report/contract.js";

describe("degraded reports", () => {
  it("remain useful when structural evidence is unavailable", () => {
    const report: ReviewReport = {
      reviewFirst: [],
      verifiedFacts: ["One two-line hunk changed in src/local.ts."],
      inferencesAndUnknowns: {
        inferences: [],
        unknowns: ["Downstream semantic reach is unknown."],
      },
      coverageLimits: [
        "Enhanced Node collector unavailable.",
        "Textual reference breadth unavailable.",
      ],
      tests: {
        changed: ["tests/local.test.ts"],
        candidates: [],
        unverifiedAreas: [],
      },
    };

    expect(validateReviewReport(report)).toBe(report);
  });
});
