import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");

interface Marketplace {
  plugins: Array<{
    source: string | {
      source: string;
      path: string;
    };
    policy?: {
      installation: string;
      authentication: string;
    };
  }>;
}

async function readJson(path: string): Promise<Marketplace> {
  return JSON.parse(await readFile(resolve(root, path), "utf8")) as Marketplace;
}

describe("marketplaces", () => {
  it("points both hosts at the repository plugin root", async () => {
    const [codex, claude] = await Promise.all([
      readJson(".agents/plugins/marketplace.json"),
      readJson(".claude-plugin/marketplace.json"),
    ]);

    expect(codex.plugins).toHaveLength(1);
    expect(codex.plugins[0]?.source).toEqual({ source: "local", path: "./" });
    expect(codex.plugins[0]?.policy).toEqual({
      installation: "AVAILABLE",
      authentication: "ON_INSTALL",
    });
    expect(claude.plugins).toHaveLength(1);
    expect(claude.plugins[0]?.source).toBe("./");
  });
});
