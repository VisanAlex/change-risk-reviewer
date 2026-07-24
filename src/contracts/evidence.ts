export type JsonPrimitive = boolean | null | number | string;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type PriorityBand = "elevated" | "notable" | "context";

export type ReasonCode =
  | "BINARY_CHANGE"
  | "BROAD_TEXTUAL_REACH"
  | "CONTROL_FLOW_CHANGE"
  | "CONTROL_FLOW_TOKEN"
  | "FILE_ROLE"
  | "GENERATED_FILE"
  | "HISTORY_COCHANGE_BREADTH"
  | "HISTORY_CHANGE_FREQUENCY"
  | "IMPORT_REFERENCE_BREADTH"
  | "NO_TEST_CHANGE"
  | "PUBLIC_SURFACE_CHANGE"
  | "PUBLIC_SURFACE_TOKEN"
  | "SENSITIVE_FILE_ROLE"
  | "SENSITIVE_SHARED_PATH"
  | "SMALL_HUNK_BROAD_REACH"
  | "TEST_FILE_CHANGED"
  | "TEXTUAL_REFERENCE_BREADTH";

export interface LineRange {
  start: number;
  count: number;
}

export interface SourceLocation {
  path: string;
  side: "current" | "old";
  start: number;
  end: number;
  deleted: boolean;
}

export interface ChangedLine {
  kind: "add" | "delete" | "context";
  oldLine: number | null;
  newLine: number | null;
  content: string;
}

export interface ChangedHunk {
  id: string;
  path: string;
  header: string;
  oldRange: LineRange;
  newRange: LineRange;
  location: SourceLocation;
  lines: ChangedLine[];
  editKind: "added" | "deleted" | "modified" | "renamed";
  binary: boolean;
  generated: boolean;
}

export interface EvidenceSource {
  tool: string;
  args: string[];
  cwd?: string;
}

export interface EvidenceFact {
  id: string;
  hunkId: string;
  reasonCode: ReasonCode;
  collector: string;
  source: EvidenceSource;
  strength: "verified";
  value: unknown;
  limits?: Record<string, JsonValue>;
}

export interface CapabilityRecord {
  collector: string;
  status: "available" | "partial" | "unavailable";
  details: string;
  limits: Record<string, JsonValue>;
}

export interface ReviewCandidate {
  hunkId: string;
  location: SourceLocation;
  band: PriorityBand;
  reasons: ReasonCode[];
  tieBreak: {
    precedence: number;
    path: string;
    line: number;
  };
}

export interface ChangedFile {
  path: string;
  editKind: ChangedHunk["editKind"];
  binary: boolean;
  hunkCount: number;
}

export interface WorkingScope {
  kind: "working";
  headObject: string | null;
}

export interface RangeScope {
  kind: "range";
  baseInput: string;
  headInput: string;
  baseObject: string;
  headObject: string;
  mergeBaseObject: string;
}

export type ReviewScope = WorkingScope | RangeScope;

export interface EvidenceEnvelopeV1 {
  schemaVersion: "1";
  scope: ReviewScope;
  repository: {
    root: string;
    headObject: string | null;
    dirty: boolean;
  };
  capabilities: CapabilityRecord[];
  changedFiles: ChangedFile[];
  facts: EvidenceFact[];
  candidates: ReviewCandidate[];
  tests: {
    changed: string[];
    candidates: string[];
    unverifiedAreas: string[];
  };
  warnings: string[];
  [key: string]: unknown;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function assertEvidenceEnvelopeV1(value: unknown): EvidenceEnvelopeV1 {
  if (!isObject(value) || value.schemaVersion !== "1") {
    throw new Error("Evidence envelope must use schemaVersion 1");
  }
  if (!isObject(value.scope) || !["working", "range"].includes(String(value.scope.kind))) {
    throw new Error("Evidence envelope has an invalid scope");
  }
  if (!isObject(value.repository) || typeof value.repository.root !== "string") {
    throw new Error("Evidence envelope has invalid repository metadata");
  }
  if (!Array.isArray(value.facts)) {
    throw new Error("Evidence envelope facts must be an array");
  }

  for (const fact of value.facts) {
    if (!isObject(fact) || !isObject(fact.source) || typeof fact.source.tool !== "string" || !Array.isArray(fact.source.args)) {
      throw new Error("Every evidence fact must include a source command");
    }
    if (fact.strength !== "verified") {
      throw new Error("Deterministic evidence facts must be marked verified");
    }
  }

  for (const field of ["capabilities", "changedFiles", "candidates", "warnings"]) {
    if (!Array.isArray(value[field])) {
      throw new Error(`Evidence envelope ${field} must be an array`);
    }
  }
  if (!isObject(value.tests)) {
    throw new Error("Evidence envelope test signals are missing");
  }

  return value as unknown as EvidenceEnvelopeV1;
}

function normalizeForSerialization(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeForSerialization);
  }
  if (isObject(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, normalizeForSerialization(child)]),
    );
  }
  return value;
}

export function stableSerialize(value: unknown): string {
  return JSON.stringify(normalizeForSerialization(value));
}
