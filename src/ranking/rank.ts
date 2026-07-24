import type {
  ChangedHunk,
  EvidenceFact,
  PriorityBand,
  ReasonCode,
  ReviewCandidate,
} from "../contracts/evidence.js";

const BAND_ORDER: Record<PriorityBand, number> = {
  elevated: 0,
  notable: 1,
  context: 2,
};

const REASON_PRECEDENCE: Partial<Record<ReasonCode, number>> = {
  SMALL_HUNK_BROAD_REACH: 10,
  SENSITIVE_SHARED_PATH: 20,
  BROAD_TEXTUAL_REACH: 30,
  CONTROL_FLOW_CHANGE: 40,
  PUBLIC_SURFACE_CHANGE: 50,
  SENSITIVE_FILE_ROLE: 60,
  NO_TEST_CHANGE: 70,
  GENERATED_FILE: 90,
};

function numericFact(facts: EvidenceFact[], code: ReasonCode): number {
  const values = facts
    .filter((fact) => fact.reasonCode === code)
    .map((fact) => {
      if (typeof fact.value === "object" && fact.value !== null && "count" in fact.value) {
        const count = (fact.value as { count?: unknown }).count;
        return typeof count === "number" ? count : 0;
      }
      return 0;
    });
  return Math.max(0, ...values);
}

function roles(facts: EvidenceFact[]): string[] {
  return facts.flatMap((fact) => {
    if (fact.reasonCode !== "FILE_ROLE" || typeof fact.value !== "object" || fact.value === null) {
      return [];
    }
    const value = (fact.value as { roles?: unknown }).roles;
    return Array.isArray(value) ? value.filter((role): role is string => typeof role === "string") : [];
  });
}

export function rankCandidates(
  hunks: readonly ChangedHunk[],
  facts: readonly EvidenceFact[],
  testsChanged: boolean,
): ReviewCandidate[] {
  const candidates = hunks.map((hunk): ReviewCandidate => {
    const hunkFacts = facts.filter((fact) => fact.hunkId === hunk.id);
    const textualBreadth = numericFact(hunkFacts, "TEXTUAL_REFERENCE_BREADTH");
    const importBreadth = numericFact(hunkFacts, "IMPORT_REFERENCE_BREADTH");
    const changedLineCount = hunk.lines.filter((line) => line.kind !== "context").length;
    const hunkRoles = roles(hunkFacts);
    const hasControl = hunkFacts.some((fact) => fact.reasonCode === "CONTROL_FLOW_TOKEN");
    const hasPublicSurface = hunkFacts.some((fact) => fact.reasonCode === "PUBLIC_SURFACE_TOKEN");
    const sensitive = hunkRoles.some((role) =>
      ["auth-policy", "configuration", "migration", "routing", "shared-core"].includes(role),
    );
    const generated = hunk.generated || hunkFacts.some((fact) => fact.reasonCode === "GENERATED_FILE");
    const broadReach = textualBreadth >= 5 || importBreadth >= 3;
    const reasons: ReasonCode[] = [];
    let band: PriorityBand = "context";

    if (changedLineCount <= 10 && broadReach && !generated) {
      reasons.push("SMALL_HUNK_BROAD_REACH");
      band = "elevated";
    }
    if (sensitive && broadReach && !generated) {
      reasons.push("SENSITIVE_SHARED_PATH");
      band = "elevated";
    }
    if (textualBreadth >= 3 || importBreadth >= 2) {
      reasons.push("BROAD_TEXTUAL_REACH");
      if (band === "context") {
        band = "notable";
      }
    }
    if (hasControl) {
      reasons.push("CONTROL_FLOW_CHANGE");
      if (band === "context" && sensitive) {
        band = "notable";
      }
    }
    if (hasPublicSurface) {
      reasons.push("PUBLIC_SURFACE_CHANGE");
      if (band === "context") {
        band = "notable";
      }
    }
    if (sensitive) {
      reasons.push("SENSITIVE_FILE_ROLE");
      if (band === "context") {
        band = "notable";
      }
    }
    if (!testsChanged && band !== "context") {
      reasons.push("NO_TEST_CHANGE");
    }
    if (generated) {
      reasons.push("GENERATED_FILE");
      if (band === "elevated") {
        band = "notable";
      } else if (!broadReach) {
        band = "context";
      }
    }

    const uniqueReasons = [...new Set(reasons)];
    const precedence = Math.min(100, ...uniqueReasons.map((reason) => REASON_PRECEDENCE[reason] ?? 80));
    return {
      hunkId: hunk.id,
      location: hunk.location,
      band,
      reasons: uniqueReasons,
      tieBreak: {
        precedence,
        path: hunk.path,
        line: hunk.location.start,
      },
    };
  });

  return candidates.sort(
    (left, right) =>
      BAND_ORDER[left.band] - BAND_ORDER[right.band] ||
      left.tieBreak.precedence - right.tieBreak.precedence ||
      left.tieBreak.path.localeCompare(right.tieBreak.path) ||
      left.tieBreak.line - right.tieBreak.line ||
      left.hunkId.localeCompare(right.hunkId),
  );
}
