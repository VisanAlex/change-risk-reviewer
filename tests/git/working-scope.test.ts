import { describe, expect, it } from "vitest";
import { analyzeChange } from "../../src/analyze.js";
import { resolveWorkingChange } from "../../src/git/scope.js";
import { createRepository, runGit, writeRepositoryFile } from "../helpers/git.js";

describe("working change scope", () => {
  it("combines tracked, staged, deleted, renamed, and untracked changes without duplicate hunks", async () => {
    const repository = await createRepository({
      ".gitignore": "ignored.txt\n",
      "src/a.ts": "export const value = 1;\n",
      "src/delete.ts": "remove me\n",
      "src/rename.ts": "rename me\n",
    });

    await writeRepositoryFile(repository, "src/a.ts", "export const value = 2;\n");
    await runGit(repository, "add", "src/a.ts");
    await writeRepositoryFile(repository, "src/a.ts", "export const value = 3;\n");
    await runGit(repository, "mv", "src/rename.ts", "src/renamed.ts");
    await runGit(repository, "rm", "src/delete.ts");
    await writeRepositoryFile(repository, "src/new file.ts", "export const fresh = true;\n");
    await writeRepositoryFile(repository, "ignored.txt", "do not inspect\n");
    await writeRepositoryFile(repository, "asset.bin", Buffer.from([0, 1, 2, 3]));

    const result = await resolveWorkingChange(repository);
    const paths = result.hunks.map((hunk) => hunk.path);

    expect(paths.filter((path) => path === "src/a.ts")).toHaveLength(1);
    expect(paths).toContain("src/delete.ts");
    expect(paths).toContain("src/renamed.ts");
    expect(paths).toContain("src/new file.ts");
    expect(paths).not.toContain("ignored.txt");
    expect(result.binaryFiles).toContain("asset.bin");
  });

  it("represents untracked empty and binary files in the evidence envelope", async () => {
    const repository = await createRepository();
    await writeRepositoryFile(repository, "empty.txt", "");
    await writeRepositoryFile(repository, "asset.bin", Buffer.from([0, 1, 2, 3]));

    const result = await resolveWorkingChange(repository);
    const empty = result.hunks.find((hunk) => hunk.path === "empty.txt");
    expect(empty?.editKind).toBe("added");
    expect(empty?.location).toEqual(expect.objectContaining({ side: "current", deleted: false }));

    const envelope = await analyzeChange({ repository, scope: { kind: "working" } });
    expect(envelope.changedFiles).toContainEqual(
      expect.objectContaining({ path: "asset.bin", editKind: "added", binary: true }),
    );
    expect(envelope.facts).toContainEqual(
      expect.objectContaining({ reasonCode: "BINARY_CHANGE" }),
    );
    const binaryCandidate = envelope.candidates.find(
      (candidate) => candidate.location.path === "asset.bin",
    );
    expect(binaryCandidate?.reasons).toContain("BINARY_CHANGE");
  });

  it("returns an empty review scope when nothing changed", async () => {
    const repository = await createRepository({ "src/a.ts": "export {};\n" });
    const result = await resolveWorkingChange(repository);

    expect(result.hunks).toEqual([]);
    expect(result.binaryFiles).toEqual([]);
  });
});
