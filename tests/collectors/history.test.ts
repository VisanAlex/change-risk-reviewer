import { describe, expect, it } from "vitest";
import { analyzeChange } from "../../src/analyze.js";
import { createRepository, runGit, writeRepositoryFile } from "../helpers/git.js";

describe("history evidence", () => {
  it("uses the selected range head when the checkout has diverged", async () => {
    const repository = await createRepository({ "src/service.ts": "export const service = 1;\n" });
    const base = (await runGit(repository, "rev-parse", "HEAD")).trim();
    await runGit(repository, "checkout", "-b", "candidate");
    await writeRepositoryFile(repository, "src/service.ts", "export const service = 2;\n");
    await writeRepositoryFile(repository, "src/consumer.ts", "export const consumer = 1;\n");
    await runGit(repository, "add", ".");
    await runGit(repository, "commit", "-m", "candidate one");
    await writeRepositoryFile(repository, "src/service.ts", "export const service = 3;\n");
    await runGit(repository, "add", ".");
    await runGit(repository, "commit", "-m", "candidate two");
    const candidate = (await runGit(repository, "rev-parse", "HEAD")).trim();
    await runGit(repository, "checkout", "main");

    const envelope = await analyzeChange({
      repository,
      scope: { kind: "range", base, head: candidate },
    });
    const frequency = envelope.facts.find(
      (fact) =>
        fact.reasonCode === "HISTORY_CHANGE_FREQUENCY" &&
        fact.hunkId.startsWith("src/service.ts:"),
    );
    const cochange = envelope.facts.find(
      (fact) =>
        fact.reasonCode === "HISTORY_COCHANGE_BREADTH" &&
        fact.hunkId.startsWith("src/service.ts:"),
    );

    expect(frequency?.value).toEqual({ count: 3, window: 100 });
    expect(cochange?.value).toEqual(
      expect.objectContaining({ count: 1, samplePaths: ["src/consumer.ts"] }),
    );
  });
});
