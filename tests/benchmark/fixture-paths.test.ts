import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveFixturePath } from "../../src/benchmark/runner.js";

describe("benchmark fixture paths", () => {
  it("keeps recipe writes inside the generated repository", () => {
    const repository = resolve("fixture-root");

    expect(resolveFixturePath(repository, "src/example.ts")).toBe(
      resolve(repository, "src", "example.ts"),
    );
    expect(resolveFixturePath(repository, "src\\example.ts")).toBe(
      resolve(repository, "src", "example.ts"),
    );
    expect(resolveFixturePath(repository, "..config")).toBe(resolve(repository, "..config"));
    expect(() => resolveFixturePath(repository, "../escaped.txt")).toThrow(/leaves the benchmark repository/i);
    expect(() => resolveFixturePath(repository, "..\\escaped.txt")).toThrow(/leaves the benchmark repository/i);
    expect(() => resolveFixturePath(repository, "/absolute.txt")).toThrow(/absolute/i);
    expect(() => resolveFixturePath(repository, "\\absolute.txt")).toThrow(/absolute/i);
    expect(() => resolveFixturePath(repository, "C:\\absolute.txt")).toThrow(/absolute/i);
  });
});
