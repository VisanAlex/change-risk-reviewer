import { describe, expect, it } from "vitest";
import {
  assertEvidenceEnvelopeV1,
  stableSerialize,
  type EvidenceEnvelopeV1,
} from "../../src/contracts/evidence.js";

function minimalEnvelope(): EvidenceEnvelopeV1 {
  return {
    schemaVersion: "1",
    scope: {
      kind: "working",
      headObject: "abc123",
    },
    repository: {
      root: "/repo",
      headObject: "abc123",
      dirty: true,
    },
    capabilities: [],
    changedFiles: [],
    facts: [],
    candidates: [],
    tests: {
      changed: [],
      candidates: [],
      unverifiedAreas: [],
    },
    warnings: [],
  };
}

describe("EvidenceEnvelopeV1", () => {
  it("accepts additive fields and serializes object keys stably", () => {
    const envelope = {
      ...minimalEnvelope(),
      futureField: { z: 1, a: 2 },
    };

    expect(assertEvidenceEnvelopeV1(envelope)).toBe(envelope);
    expect(stableSerialize(envelope)).toContain('"futureField":{"a":2,"z":1}');
  });

  it("rejects facts without reproducible provenance", () => {
    const envelope = minimalEnvelope() as unknown as Record<string, unknown>;
    envelope.facts = [
      {
        id: "fact-1",
        hunkId: "src/core.ts:1:1:0",
        reasonCode: "CONTROL_FLOW_TOKEN",
        collector: "tokens",
        strength: "verified",
        value: { tokens: ["if"] },
      },
    ];

    expect(() => assertEvidenceEnvelopeV1(envelope)).toThrow(/source command/i);
  });
});
