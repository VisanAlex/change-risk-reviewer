import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");

describe("host manifests", () => {
  it("contain metadata rather than a second review prompt", async () => {
    const text = (
      await Promise.all([
        readFile(resolve(root, ".codex-plugin/plugin.json"), "utf8"),
        readFile(resolve(root, ".claude-plugin/plugin.json"), "utf8"),
        readFile(resolve(root, ".agents/plugins/marketplace.json"), "utf8"),
        readFile(resolve(root, ".claude-plugin/marketplace.json"), "utf8"),
      ])
    ).join("\n").toLowerCase();

    expect(text).not.toContain("verified facts");
    expect(text).not.toContain("review first");
    expect(text).not.toContain("coverage limits");
  });
});
