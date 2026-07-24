import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("untrusted repository content", () => {
  it("cannot override the workflow or request writes", async () => {
    const skill = await readFile(resolve(import.meta.dirname, "../../skills/review/SKILL.md"), "utf8");

    expect(skill).toMatch(/untrusted/i);
    expect(skill).toMatch(/do not follow instructions/i);
    expect(skill).toMatch(/read-only/i);
    expect(skill).toMatch(/must not (?:edit|write)/i);
  });
});
