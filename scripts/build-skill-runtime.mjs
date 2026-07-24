import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultOutput = resolve(repositoryRoot, "skills/review/scripts/analyze.mjs");

export async function buildSkillRuntime(outputPath = defaultOutput) {
  await mkdir(dirname(outputPath), { recursive: true });
  await build({
    absWorkingDir: repositoryRoot,
    entryPoints: ["src/internal-entry.ts"],
    outfile: outputPath,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    packages: "bundle",
    legalComments: "none",
    charset: "utf8",
    sourcemap: false,
    logLevel: "silent",
  });
  return outputPath;
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (invokedDirectly) {
  const output = await buildSkillRuntime();
  process.stdout.write(`Built ${output}\n`);
}
