import { describe, expect, it } from "vitest";
import { validateReviewReport, type ReviewReport } from "../../src/report/contract.js";

function reportWith(statement: string): ReviewReport {
  return {
    reviewFirst: [],
    verifiedFacts: [statement],
    inferencesAndUnknowns: { inferences: [], unknowns: [] },
    coverageLimits: [],
    tests: { changed: [], candidates: [], unverifiedAreas: [] },
  };
}

describe("forbidden merge verdicts", () => {
  it.each(["This is safe to merge.", "Approved.", "There is no risk.", "Ship it."])(
    "rejects %s",
    (statement) => {
      expect(() => validateReviewReport(reportWith(statement))).toThrow(/merge verdict/i);
    },
  );

  it("rejects high-confidence inference without evidence", () => {
    const report = reportWith("The guard changed.");
    report.inferencesAndUnknowns.inferences.push({
      statement: "All consumers will fail.",
      confidence: "high",
      evidenceFactIds: [],
    });
    expect(() => validateReviewReport(report)).toThrow(/evidence/i);
  });
});
