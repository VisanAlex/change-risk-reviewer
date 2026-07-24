import { describe, expect, it } from "vitest";
import { ScopeResolutionError, resolveRevisionRange } from "../../src/git/scope.js";
import { createRepository, runGit, writeRepositoryFile } from "../helpers/git.js";

describe("revision range scope", () => {
  it("resolves object IDs and analyzes a merge-base-aware range", async () => {
    const repository = await createRepository({ "src/value.ts": "export const value = 1;\n" });
    const base = (await runGit(repository, "rev-parse", "HEAD")).trim();
    await writeRepositoryFile(repository, "src/value.ts", "export const value = 2;\n");
    await runGit(repository, "add", ".");
    await runGit(repository, "commit", "-m", "change value");

    const result = await resolveRevisionRange(repository, base, "HEAD");

    expect(result.scope.kind).toBe("range");
    if (result.scope.kind !== "range") {
      throw new Error("Expected a range scope");
    }
    expect(result.scope.baseObject).toBe(base);
    expect(result.scope.headObject).toMatch(/^[0-9a-f]{40,64}$/);
    expect(result.hunks[0]?.path).toBe("src/value.ts");
  });

  it("rejects invalid and option-like revisions without falling back", async () => {
    const repository = await createRepository();

    await expect(resolveRevisionRange(repository, "--help", "HEAD")).rejects.toBeInstanceOf(ScopeResolutionError);
    await expect(resolveRevisionRange(repository, "missing;echo owned", "HEAD")).rejects.toBeInstanceOf(
      ScopeResolutionError,
    );
  });

  it("discloses when the configured diff output bound truncates a range", async () => {
    const repository = await createRepository({ "src/value.ts": "export const value = 1;\n" });
    const base = (await runGit(repository, "rev-parse", "HEAD")).trim();
    await writeRepositoryFile(repository, "src/value.ts", "export const value = 222222222222222;\n");
    await runGit(repository, "add", ".");
    await runGit(repository, "commit", "-m", "change value");

    const result = await resolveRevisionRange(repository, base, "HEAD", { maxDiffOutputBytes: 80 });

    expect(result.diffTruncated).toBe(true);
    expect(result.warnings.join(" ")).toMatch(/truncated/i);
  });
});
