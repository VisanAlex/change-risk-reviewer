import type { SourceLocation } from "../contracts/evidence.js";

export type Confidence = "high" | "medium" | "low";

export interface ReportInference {
  statement: string;
  confidence: Confidence;
  evidenceFactIds: string[];
}

export interface ReviewFinding {
  location: SourceLocation;
  evidence: Array<{
    factId: string;
    statement: string;
  }>;
  potentialImpact: ReportInference;
  action: string;
}

export interface ReviewReport {
  reviewFirst: ReviewFinding[];
  verifiedFacts: string[];
  inferencesAndUnknowns: {
    inferences: ReportInference[];
    unknowns: string[];
  };
  coverageLimits: string[];
  tests: {
    changed: string[];
    candidates: string[];
    unverifiedAreas: string[];
  };
}

const FORBIDDEN_VERDICT = /\b(?:approved|no risk|safe(?:\s+to\s+merge)?|ship it)\b/iu;

function allStrings(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(allStrings);
  }
  if (typeof value === "object" && value !== null) {
    return Object.values(value).flatMap(allStrings);
  }
  return [];
}

function assertInference(inference: ReportInference): void {
  if (inference.statement.trim().length === 0) {
    throw new Error("Every inference needs a statement");
  }
  if (!["high", "medium", "low"].includes(inference.confidence)) {
    throw new Error("Every inference needs calibrated confidence");
  }
  if (inference.evidenceFactIds.length === 0) {
    throw new Error("Every inference must cite supporting evidence fact IDs");
  }
}

export function validateReviewReport(report: ReviewReport): ReviewReport {
  if (report.reviewFirst.length > 5) {
    throw new Error("Review-first output cannot contain more than five locations");
  }
  for (const finding of report.reviewFirst) {
    if (
      finding.location.path.length === 0 ||
      finding.location.start < 1 ||
      finding.location.end < finding.location.start
    ) {
      throw new Error("Every finding needs an exact source location");
    }
    if (finding.evidence.length === 0 || finding.evidence.some((item) => item.factId.length === 0)) {
      throw new Error("Every finding needs cited verified evidence");
    }
    if (finding.action.trim().length === 0) {
      throw new Error("Every finding needs a concrete verification action");
    }
    assertInference(finding.potentialImpact);
  }
  for (const inference of report.inferencesAndUnknowns.inferences) {
    assertInference(inference);
  }
  if (allStrings(report).some((text) => FORBIDDEN_VERDICT.test(text))) {
    throw new Error("The report contains a forbidden merge verdict");
  }
  return report;
}
