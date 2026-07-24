import { describe, expect, it } from "vitest";
import { validateReviewReport, type ReviewReport } from "../../src/report/contract.js";

function validReport(): ReviewReport {
  return {
    reviewFirst: [
      {
        location: {
          path: "src/core/dispatch.ts",
          side: "current",
          start: 14,
          end: 14,
          deleted: false,
        },
        evidence: [
          {
            factId: "dispatch:text-breadth",
            statement: "42 tracked files contain a bounded literal reference.",
          },
        ],
        potentialImpact: {
          statement: "Unrelated request paths may now skip the shared dispatch guard.",
          confidence: "medium",
          evidenceFactIds: ["dispatch:text-breadth"],
        },
        action: "Exercise two unrelated consumers through the shared dispatch path.",
      },
    ],
    verifiedFacts: ["42 tracked files contain a bounded literal reference."],
    inferencesAndUnknowns: {
      inferences: [
        {
          statement: "Unrelated request paths may now skip the shared dispatch guard.",
          confidence: "medium",
          evidenceFactIds: ["dispatch:text-breadth"],
        },
      ],
      unknowns: ["No semantic call graph was available."],
    },
    coverageLimits: ["Reference breadth is textual, not a call-site count."],
    tests: {
      changed: [],
      candidates: ["tests/dispatch.test.ts"],
      unverifiedAreas: ["src/core/dispatch.ts"],
    },
  };
}

describe("review report contract", () => {
  it("accepts evidence-linked findings with calibrated inferences", () => {
    const report = validReport();
    expect(validateReviewReport(report)).toBe(report);
  });

  it("limits review-first output to five exact locations", () => {
    const report = validReport();
    report.reviewFirst = Array.from({ length: 6 }, () => report.reviewFirst[0]!);
    expect(() => validateReviewReport(report)).toThrow(/five/i);
  });

  it("allows an honest empty-change report", () => {
    const report: ReviewReport = {
      reviewFirst: [],
      verifiedFacts: ["No changed hunks were found in the selected scope."],
      inferencesAndUnknowns: { inferences: [], unknowns: [] },
      coverageLimits: [],
      tests: { changed: [], candidates: [], unverifiedAreas: [] },
    };
    expect(validateReviewReport(report)).toBe(report);
  });
});
