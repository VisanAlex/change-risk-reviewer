import process from "node:process";
import { resolve } from "node:path";
import { analyzeChange, type AnalyzeChangeOptions } from "./analyze.js";
import { stableSerialize } from "./contracts/evidence.js";
import { createReviewInput } from "./contracts/review-input.js";

interface ParsedArguments {
  repository: string;
  scope: AnalyzeChangeOptions["scope"];
  pretty: boolean;
  output: "compact" | "full";
}

function usage(): string {
  return "Usage: analyze.mjs [--repo <path>] [--base <revision> --head <revision>] [--compact | --full] [--pretty]";
}

function parseArguments(args: readonly string[]): ParsedArguments {
  let repository = process.cwd();
  let base: string | undefined;
  let head: string | undefined;
  let pretty = false;
  let output: ParsedArguments["output"] = "compact";
  let outputWasSelected = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--pretty") {
      pretty = true;
      continue;
    }
    if (argument === "--compact" || argument === "--full") {
      if (outputWasSelected) {
        throw new Error("--compact and --full cannot be combined or repeated");
      }
      output = argument === "--compact" ? "compact" : "full";
      outputWasSelected = true;
      continue;
    }
    if (argument === "--repo" || argument === "--base" || argument === "--head") {
      const value = args[index + 1];
      if (value === undefined) {
        throw new Error(`${argument} requires a value`);
      }
      index += 1;
      if (argument === "--repo") {
        repository = value;
      } else if (argument === "--base") {
        base = value;
      } else {
        head = value;
      }
      continue;
    }
    if (argument === "--help") {
      process.stdout.write(`${usage()}\n`);
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${argument}`);
  }

  if ((base === undefined) !== (head === undefined)) {
    throw new Error("--base and --head must be provided together");
  }
  return {
    repository: resolve(repository),
    scope:
      base !== undefined && head !== undefined
        ? { kind: "range", base, head }
        : { kind: "working" },
    pretty,
    output,
  };
}

async function main(): Promise<void> {
  const parsed = parseArguments(process.argv.slice(2));
  const envelope = await analyzeChange({
    repository: parsed.repository,
    scope: parsed.scope,
  });
  const output = parsed.output === "compact" ? createReviewInput(envelope) : envelope;
  const serialized = parsed.pretty
    ? JSON.stringify(output, null, 2)
    : stableSerialize(output);
  process.stdout.write(`${serialized}\n`);
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(
    `${JSON.stringify({
      error: {
        name: error instanceof Error ? error.name : "Error",
        message,
      },
    })}\n`,
  );
  process.exitCode = 1;
}
