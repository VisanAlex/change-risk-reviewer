import { describe, expect, it } from "vitest";
import { rankCandidates } from "../../src/ranking/rank.js";
import type { ChangedHunk, EvidenceFact } from "../../src/contracts/evidence.js";

function hunk(id: string, path: string, changedLineCount: number, generated = false): ChangedHunk {
  return {
    id,
    path,
    header: "@@ -1 +1 @@",
    oldRange: { start: 1, count: 1 },
    newRange: { start: 1, count: 1 },
    location: { path, side: "current", start: 1, end: 1, deleted: false },
    lines: Array.from({ length: changedLineCount }, (_, index) => ({
      kind: "add" as const,
      oldLine: null,
      newLine: index + 1,
      content: "value",
    })),
    editKind: "modified",
    binary: false,
    generated,
  };
}

function fact(hunkId: string, reasonCode: EvidenceFact["reasonCode"], value: unknown): EvidenceFact {
  return {
    id: `${hunkId}:${reasonCode}`,
    hunkId,
    reasonCode,
    collector: "fixture",
    source: { tool: "fixture", args: [] },
    strength: "verified",
    value,
  };
}

describe("candidate ranking", () => {
  it("ranks a small broadly referenced control change above large volume", () => {
    const central = hunk("central", "src/core/dispatch.ts", 2);
    const generated = Array.from({ length: 50 }, (_, index) =>
      hunk(`generated-${index}`, `src/generated/feature-${index}.ts`, 80, true),
    );
    const facts: EvidenceFact[] = [
      fact("central", "TEXTUAL_REFERENCE_BREADTH", { count: 42, samplePaths: [] }),
      fact("central", "IMPORT_REFERENCE_BREADTH", { count: 18, samplePaths: [] }),
      fact("central", "CONTROL_FLOW_TOKEN", { tokens: ["if", "return"] }),
      fact("central", "FILE_ROLE", { roles: ["shared-core"] }),
      ...generated.map((item) => fact(item.id, "GENERATED_FILE", { generated: true })),
    ];

    const ranked = rankCandidates([central, ...generated], facts, false);

    expect(ranked[0]?.hunkId).toBe("central");
    expect(ranked[0]?.band).toBe("elevated");
    expect(ranked[0]?.reasons).toContain("SMALL_HUNK_BROAD_REACH");
    expect(ranked.slice(0, 5).some((candidate) => candidate.hunkId === "central")).toBe(true);
  });

  it("stays concise and contextual for an isolated low-signal change", () => {
    const isolated = hunk("isolated", "src/local.ts", 2);
    const ranked = rankCandidates([isolated], [], true);

    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.band).toBe("context");
    expect(ranked[0]?.reasons).not.toContain("NO_TEST_CHANGE");
  });

  it("does not let documentation references outrank runtime code", () => {
    const documentation = hunk("docs", "docs/architecture.md", 2);
    const runtime = hunk("runtime", "src/service.ts", 2);
    const facts: EvidenceFact[] = [
      fact("docs", "FILE_ROLE", { roles: ["documentation"] }),
      fact("docs", "TEXTUAL_REFERENCE_BREADTH", { count: 42, samplePaths: [] }),
      fact("docs", "PUBLIC_SURFACE_TOKEN", { tokens: ["interface"] }),
      fact("runtime", "PUBLIC_SURFACE_TOKEN", { tokens: ["export"] }),
    ];

    const ranked = rankCandidates([documentation, runtime], facts, false);

    expect(ranked[0]?.hunkId).toBe("runtime");
    expect(ranked.find((candidate) => candidate.hunkId === "docs")?.band).toBe("context");
  });
});
