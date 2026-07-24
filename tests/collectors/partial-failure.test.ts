import { describe, expect, it } from "vitest";
import { analyzeChange } from "../../src/analyze.js";
import { createRepository, writeRepositoryFile } from "../helpers/git.js";

describe("collector degradation", () => {
  it("keeps completed evidence when ripgrep is unavailable", async () => {
    const repository = await createRepository({
      "src/core/router.ts": "export function route() { return true; }\n",
    });
    await writeRepositoryFile(repository, "src/core/router.ts", "export function route() { return false; }\n");

    const envelope = await analyzeChange({
      repository,
      scope: { kind: "working" },
      collectorOptions: { rgCommand: "definitely-missing-change-risk-rg" },
    });

    expect(envelope.facts.some((fact) => fact.reasonCode === "FILE_ROLE")).toBe(true);
    expect(envelope.capabilities).toContainEqual(
      expect.objectContaining({
        collector: "text-references",
        status: "unavailable",
      }),
    );
    expect(envelope.warnings.join(" ")).toMatch(/textual reference/i);
  });

  it("keeps completed evidence when ripgrep fails after preflight", async () => {
    const repository = await createRepository({
      "src/core/router.ts": "export function route() { return true; }\n",
    });
    await writeRepositoryFile(repository, "src/core/router.ts", "export function route() { return false; }\n");

    const envelope = await analyzeChange({
      repository,
      scope: { kind: "working" },
      collectorOptions: { rgCommand: process.execPath },
    });

    expect(envelope.facts.some((fact) => fact.reasonCode === "FILE_ROLE")).toBe(true);
    expect(envelope.capabilities).toContainEqual(
      expect.objectContaining({
        collector: "text-references",
        status: "unavailable",
      }),
    );
    expect(envelope.warnings.join(" ")).toMatch(/reference evidence is incomplete/i);
  });
});
