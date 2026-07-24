import { spawn } from "node:child_process";

export interface ProcessResult {
  code: number;
  stdout: string;
  stderr: string;
  truncated: boolean;
}

export class ProcessExecutionError extends Error {
  readonly code: number | null;
  readonly stderr: string;

  constructor(message: string, code: number | null, stderr = "") {
    super(message);
    this.name = "ProcessExecutionError";
    this.code = code;
    this.stderr = stderr;
  }
}

export async function runProcess(
  command: string,
  args: readonly string[],
  options: {
    cwd: string;
    timeoutMs?: number;
    maxOutputBytes?: number;
    allowExitCodes?: readonly number[];
  },
): Promise<ProcessResult> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const maxOutputBytes = options.maxOutputBytes ?? 4 * 1024 * 1024;
  const allowExitCodes = options.allowExitCodes ?? [0];

  return await new Promise<ProcessResult>((resolve, reject) => {
    const child = spawn(command, [...args], {
      cwd: options.cwd,
      env: {
        ...process.env,
        GIT_EXTERNAL_DIFF: "",
        GIT_OPTIONAL_LOCKS: "0",
        GIT_PAGER: "cat",
        LC_ALL: "C",
        PAGER: "cat",
      },
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let outputBytes = 0;
    let truncated = false;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    const capture = (target: "stdout" | "stderr", chunk: Buffer): void => {
      const remaining = Math.max(0, maxOutputBytes - outputBytes);
      if (remaining === 0) {
        truncated = true;
        return;
      }
      const accepted = chunk.subarray(0, remaining);
      outputBytes += accepted.byteLength;
      if (accepted.byteLength < chunk.byteLength) {
        truncated = true;
      }
      if (target === "stdout") {
        stdout += accepted.toString("utf8");
      } else {
        stderr += accepted.toString("utf8");
      }
    };

    child.stdout.on("data", (chunk: Buffer) => capture("stdout", chunk));
    child.stderr.on("data", (chunk: Buffer) => capture("stderr", chunk));
    child.on("error", (error: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      reject(new ProcessExecutionError(`Could not start ${command}: ${error.code ?? error.message}`, null));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new ProcessExecutionError(`${command} timed out after ${timeoutMs}ms`, code, stderr));
        return;
      }
      const normalizedCode = code ?? -1;
      if (!allowExitCodes.includes(normalizedCode)) {
        reject(new ProcessExecutionError(`${command} exited with ${normalizedCode}`, code, stderr));
        return;
      }
      resolve({ code: normalizedCode, stdout, stderr, truncated });
    });
  });
}

export async function runGit(
  repository: string,
  args: readonly string[],
  options: Omit<Parameters<typeof runProcess>[2], "cwd"> = {},
): Promise<ProcessResult> {
  return await runProcess(
    "git",
    ["--no-pager", "-c", "core.quotePath=false", ...args],
    { ...options, cwd: repository },
  );
}
