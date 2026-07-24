import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";

export async function runGit(repository: string, ...args: string[]): Promise<string> {
  const result = await new Promise<{ code: number | null; stderr: string; stdout: string }>((resolve, reject) => {
    const child = spawn("git", args, {
      cwd: repository,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stderr, stdout }));
  });

  if (result.code !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  }
  return result.stdout;
}

export async function writeRepositoryFile(repository: string, path: string, content: string | Buffer): Promise<void> {
  const target = join(repository, ...path.split("/"));
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content);
}

export async function createRepository(files: Record<string, string> = {}): Promise<string> {
  const repository = await mkdtemp(join(tmpdir(), "change-risk-reviewer-"));
  await runGit(repository, "init", "-b", "main");
  await runGit(repository, "config", "user.name", "Fixture");
  await runGit(repository, "config", "user.email", "fixture@example.invalid");

  for (const [path, content] of Object.entries(files)) {
    await writeRepositoryFile(repository, path, content);
  }

  await runGit(repository, "add", ".");
  await runGit(repository, "commit", "--allow-empty", "-m", "base");
  return repository;
}
