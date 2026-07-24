import { describe, expect, it } from "vitest";
import { analyzeChange } from "../../src/analyze.js";
import { createRepository, runGit, writeRepositoryFile } from "../helpers/git.js";

describe("textual reference evidence", () => {
  it("labels occurrences as textual/import evidence rather than call sites", async () => {
    const files: Record<string, string> = {
      "src/core/dispatch.ts": "export function dispatch() { return true; }\n",
    };
    for (let index = 0; index < 8; index += 1) {
      files[`src/features/consumer-${index}.ts`] =
        `import { dispatch } from "../core/dispatch";\nexport const feature${index} = dispatch();\n`;
    }
    const repository = await createRepository(files);
    await writeRepositoryFile(
      repository,
      "src/core/dispatch.ts",
      "export function dispatch() { if (enabled) return false; return true; }\n",
    );

    const envelope = await analyzeChange({ repository, scope: { kind: "working" } });
    const facts = envelope.facts.filter((fact) => fact.hunkId === envelope.candidates[0]?.hunkId);

    expect(facts.some((fact) => fact.reasonCode === "TEXTUAL_REFERENCE_BREADTH")).toBe(true);
    expect(facts.some((fact) => fact.reasonCode === "IMPORT_REFERENCE_BREADTH")).toBe(true);
    expect(JSON.stringify(facts).toLowerCase()).not.toContain("call site");
    expect(envelope.candidates[0]?.band).toBe("elevated");
  });

  it("recognizes PHP use imports in a Laravel and Livewire repository", async () => {
    const files: Record<string, string> = {
      "app/Services/PayrollService.php":
        "<?php\nnamespace App\\Services;\nclass PayrollService { public function visible(): bool { return true; } }\n",
    };
    for (let index = 0; index < 8; index += 1) {
      files[`app/Livewire/PayrollWidget${index}.php`] =
        `<?php\nnamespace App\\Livewire;\nuse App\\Services\\PayrollService;\nclass PayrollWidget${index} { public function render(PayrollService $service): bool { return $service->visible(); } }\n`;
    }
    const repository = await createRepository(files);
    await writeRepositoryFile(
      repository,
      "app/Services/PayrollService.php",
      "<?php\nnamespace App\\Services;\nclass PayrollService { public function visible(): bool { if ($this->locked) return false; return true; } }\n",
    );

    const envelope = await analyzeChange({ repository, scope: { kind: "working" } });
    const serviceHunk = envelope.candidates.find(
      (candidate) => candidate.location.path === "app/Services/PayrollService.php",
    );
    const importBreadth = envelope.facts.find(
      (fact) =>
        fact.hunkId === serviceHunk?.hunkId &&
        fact.reasonCode === "IMPORT_REFERENCE_BREADTH",
    );

    expect((importBreadth?.value as { count: number }).count).toBe(8);
    expect(serviceHunk?.band).toBe("elevated");
  });

  it("does not promote comment-only ambiguous identifiers to import evidence", async () => {
    const repository = await createRepository({
      "src/local.ts": "const run = 1;\n",
      "src/notes.ts": "// run should stay documented\n",
    });
    await writeRepositoryFile(repository, "src/local.ts", "const run = 2;\n");

    const envelope = await analyzeChange({ repository, scope: { kind: "working" } });
    const importFacts = envelope.facts.filter((fact) => fact.reasonCode === "IMPORT_REFERENCE_BREADTH");

    expect(importFacts.every((fact) => (fact.value as { count: number }).count === 0)).toBe(true);
  });

  it("collects range evidence from the selected head instead of the checkout", async () => {
    const repository = await createRepository({
      "src/core/dispatch.ts": "export function dispatch() { return true; }\n",
    });
    const base = (await runGit(repository, "rev-parse", "HEAD")).trim();
    await runGit(repository, "checkout", "-b", "candidate");
    await writeRepositoryFile(
      repository,
      "src/core/dispatch.ts",
      "export function dispatch() { if (enabled) return false; return true; }\n",
    );
    for (let index = 0; index < 8; index += 1) {
      await writeRepositoryFile(
        repository,
        `src/features/consumer-${index}.ts`,
        `import { dispatch } from "../core/dispatch";\nexport const feature${index} = dispatch();\n`,
      );
    }
    await runGit(repository, "add", ".");
    await runGit(repository, "commit", "-m", "candidate");
    const candidate = (await runGit(repository, "rev-parse", "HEAD")).trim();
    await runGit(repository, "checkout", "main");

    const envelope = await analyzeChange({
      repository,
      scope: { kind: "range", base, head: candidate },
    });
    const breadth = envelope.facts.find(
      (fact) =>
        fact.reasonCode === "TEXTUAL_REFERENCE_BREADTH" &&
        (fact.value as { count: number }).count >= 8,
    );

    expect(breadth).toBeDefined();
    expect(envelope.candidates[0]?.band).toBe("elevated");
    expect(envelope.tests.unverifiedAreas).toContain("src/core/dispatch.ts");
  });

  it("does not inspect checked-out submodule contents", async () => {
    const repository = await createRepository({
      "src/core/dispatch.ts": "export function dispatch() { return true; }\n",
    });
    const gitlinkObject = (await runGit(repository, "rev-parse", "HEAD")).trim();
    await runGit(
      repository,
      "update-index",
      "--add",
      "--cacheinfo",
      `160000,${gitlinkObject},modules/external`,
    );
    await writeRepositoryFile(
      repository,
      "modules/external/consumer.ts",
      "import { dispatch } from '../../src/core/dispatch';\nexport const result = dispatch();\n",
    );
    await writeRepositoryFile(
      repository,
      "src/core/dispatch.ts",
      "export function dispatch() { return false; }\n",
    );

    const envelope = await analyzeChange({ repository, scope: { kind: "working" } });
    const dispatchHunk = envelope.candidates.find(
      (candidate) => candidate.location.path === "src/core/dispatch.ts",
    );
    const breadth = envelope.facts.find(
      (fact) =>
        fact.hunkId === dispatchHunk?.hunkId &&
        fact.reasonCode === "TEXTUAL_REFERENCE_BREADTH",
    );
    const referenceCapability = envelope.capabilities.find(
      (capability) => capability.collector === "text-references",
    );

    expect((breadth?.value as { count: number }).count).toBe(0);
    expect(referenceCapability?.limits.excludedSubmodules).toBe(1);
  });
});
