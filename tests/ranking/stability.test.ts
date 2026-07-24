import { describe, expect, it } from "vitest";
import { rankCandidates } from "../../src/ranking/rank.js";
import type { ChangedHunk, EvidenceFact } from "../../src/contracts/evidence.js";

const baseHunk: Omit<ChangedHunk, "id" | "location" | "path"> = {
  header: "@@ -1 +1 @@",
  oldRange: { start: 1, count: 1 },
  newRange: { start: 1, count: 1 },
  lines: [{ kind: "add", oldLine: null, newLine: 1, content: "export" }],
  editKind: "modified",
  binary: false,
  generated: false,
};

function makeHunk(path: string): ChangedHunk {
  return {
    ...baseHunk,
    id: `${path}:1`,
    path,
    location: { path, side: "current", start: 1, end: 1, deleted: false },
  };
}

describe("ranking stability", () => {
  it("uses stable path and line tie breaks independent of input order", () => {
    const a = makeHunk("src/a.ts");
    const b = makeHunk("src/b.ts");
    const facts: EvidenceFact[] = [];

    const forward = rankCandidates([a, b], facts, true).map((candidate) => candidate.hunkId);
    const reverse = rankCandidates([b, a], facts, true).map((candidate) => candidate.hunkId);

    expect(reverse).toEqual(forward);
    expect(forward).toEqual(["src/a.ts:1", "src/b.ts:1"]);
  });
});
