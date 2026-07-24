import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function readJson(path) {
  return JSON.parse(await readFile(resolve(repositoryRoot, path), "utf8"));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function assertExists(path) {
  await access(resolve(repositoryRoot, path));
}

export async function validatePackaging() {
  const packageJson = await readJson("package.json");
  const codex = await readJson(".codex-plugin/plugin.json");
  const claude = await readJson(".claude-plugin/plugin.json");
  const codexMarketplace = await readJson(".agents/plugins/marketplace.json");
  const claudeMarketplace = await readJson(".claude-plugin/marketplace.json");

  for (const field of ["name", "version", "description", "repository", "license"]) {
    assert(codex[field] === claude[field], `Host manifests disagree on ${field}`);
  }

  assert(codex.name === packageJson.name, "Package and plugin names disagree");
  assert(codex.version === packageJson.version, "Package and plugin versions disagree");
  assert(codex.license === packageJson.license, "Package and plugin licenses disagree");
  assert(codex.skills === "./skills/", "Codex must use the canonical skills directory");
  assert(claude.skills === "./skills/", "Claude must use the canonical skills directory");

  const codexEntry = codexMarketplace.plugins?.[0];
  assert(codexEntry?.name === codex.name, "Codex marketplace plugin name is invalid");
  assert(codexEntry?.source?.source === "local", "Codex local source type is invalid");
  assert(codexEntry?.source?.path === "./", "Codex marketplace must target the plugin root");
  assert(codexEntry?.policy?.installation === "AVAILABLE", "Codex install policy is missing");
  assert(codexEntry?.policy?.authentication === "ON_INSTALL", "Codex auth policy is missing");
  assert(typeof codexEntry?.category === "string", "Codex category is missing");

  const claudeEntry = claudeMarketplace.plugins?.[0];
  assert(claudeEntry?.name === claude.name, "Claude marketplace plugin name is invalid");
  assert(claudeEntry?.source === "./", "Claude marketplace must target the plugin root");

  await assertExists("skills/review/SKILL.md");
  await assertExists("skills/review/agents/openai.yaml");

  const manifestText = JSON.stringify({ codex, claude });
  for (const forbidden of ["verified facts", "review first", "coverage limits"]) {
    assert(!manifestText.toLowerCase().includes(forbidden), `Host manifests duplicate workflow text: ${forbidden}`);
  }

  return {
    name: codex.name,
    version: codex.version,
    skill: "skills/review/SKILL.md",
  };
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (invokedDirectly) {
  const result = await validatePackaging();
  process.stdout.write(`Packaging valid: ${result.name}@${result.version}\n`);
}
