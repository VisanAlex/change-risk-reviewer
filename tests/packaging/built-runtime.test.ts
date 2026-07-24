import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("bundled skill runtime", () => {
  it("is committed, dependency-free, and exposes only the machine JSON helper", async () => {
    const runtime = await readFile(
      resolve(import.meta.dirname, "../../skills/review/scripts/analyze.mjs"),
      "utf8",
    );

    const bareImports = runtime
      .split("\n")
      .filter((line) => line.startsWith("import "))
      .flatMap((line) => {
        const match = /from\s+["']([^"']+)["']/u.exec(line);
        return match?.[1] !== undefined && !match[1].startsWith("node:") ? [match[1]] : [];
      });
    expect(bareImports).toEqual([]);
    expect(runtime).toMatch(/\bschemaVersion:\s*"1"/u);
    expect(runtime).not.toMatch(/commander|yargs|cac\(/u);
  });
});
