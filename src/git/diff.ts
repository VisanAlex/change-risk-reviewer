import type { ChangedHunk, ChangedLine } from "../contracts/evidence.js";

interface FileState {
  path: string | null;
  previousPath: string | null;
  editKind: ChangedHunk["editKind"];
  binary: boolean;
  hunkCount: number;
}

function stripPrefix(path: string): string {
  const unquoted = path.startsWith('"') && path.endsWith('"') ? path.slice(1, -1) : path;
  if (unquoted === "/dev/null") {
    return unquoted;
  }
  return unquoted.replace(/^[ab]\//, "").replaceAll("\\", "/");
}

function parseRange(start: string, count: string | undefined): { start: number; count: number } {
  return {
    start: Number(start),
    count: count === undefined ? 1 : Number(count),
  };
}

export function parseUnifiedDiff(patch: string): ChangedHunk[] {
  const lines = patch.replaceAll("\r\n", "\n").split("\n");
  const hunks: ChangedHunk[] = [];
  let file: FileState | null = null;
  let index = 0;

  const finalizeFile = (): void => {
    if (file?.path === null || file === null || file.hunkCount > 0) {
      return;
    }
    if (file.editKind !== "renamed" && !file.binary) {
      return;
    }
    const path = file.path;
    hunks.push({
      id: `${path}:1:1:${index++}`,
      path,
      header: file.binary ? "binary change" : `rename from ${file.previousPath ?? path}`,
      oldRange: { start: 1, count: 0 },
      newRange: { start: 1, count: 0 },
      location: { path, side: "current", start: 1, end: 1, deleted: false },
      lines: [],
      editKind: file.editKind,
      binary: file.binary,
      generated: false,
    });
  };

  for (let cursor = 0; cursor < lines.length; cursor += 1) {
    const line = lines[cursor] ?? "";
    if (line.startsWith("diff --git ")) {
      finalizeFile();
      file = {
        path: null,
        previousPath: null,
        editKind: "modified",
        binary: false,
        hunkCount: 0,
      };
      continue;
    }
    if (file === null) {
      continue;
    }
    if (line.startsWith("new file mode ")) {
      file.editKind = "added";
      continue;
    }
    if (line.startsWith("deleted file mode ")) {
      file.editKind = "deleted";
      continue;
    }
    if (line.startsWith("rename from ")) {
      file.previousPath = stripPrefix(line.slice("rename from ".length));
      file.editKind = "renamed";
      continue;
    }
    if (line.startsWith("rename to ")) {
      file.path = stripPrefix(line.slice("rename to ".length));
      file.editKind = "renamed";
      continue;
    }
    if (line.startsWith("--- ")) {
      const oldPath = stripPrefix(line.slice(4).split("\t", 1)[0] ?? "");
      if (oldPath !== "/dev/null") {
        file.previousPath = oldPath;
        if (file.path === null) {
          file.path = oldPath;
        }
      }
      continue;
    }
    if (line.startsWith("+++ ")) {
      const newPath = stripPrefix(line.slice(4).split("\t", 1)[0] ?? "");
      if (newPath !== "/dev/null") {
        file.path = newPath;
      }
      continue;
    }
    if (line.startsWith("Binary files ") || line.startsWith("GIT binary patch")) {
      file.binary = true;
      continue;
    }
    if (!line.startsWith("@@ ")) {
      continue;
    }

    const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (match === null || file.path === null) {
      continue;
    }
    const oldRange = parseRange(match[1] ?? "0", match[2]);
    const newRange = parseRange(match[3] ?? "0", match[4]);
    const changedLines: ChangedLine[] = [];
    let oldLine = oldRange.start;
    let newLine = newRange.start;
    let inner = cursor + 1;

    for (; inner < lines.length; inner += 1) {
      const contentLine = lines[inner] ?? "";
      if (contentLine.startsWith("diff --git ") || contentLine.startsWith("@@ ")) {
        break;
      }
      if (contentLine.startsWith("+") && !contentLine.startsWith("+++")) {
        changedLines.push({
          kind: "add",
          oldLine: null,
          newLine,
          content: contentLine.slice(1),
        });
        newLine += 1;
      } else if (contentLine.startsWith("-") && !contentLine.startsWith("---")) {
        changedLines.push({
          kind: "delete",
          oldLine,
          newLine: null,
          content: contentLine.slice(1),
        });
        oldLine += 1;
      } else if (contentLine.startsWith(" ")) {
        changedLines.push({
          kind: "context",
          oldLine,
          newLine,
          content: contentLine.slice(1),
        });
        oldLine += 1;
        newLine += 1;
      } else if (!contentLine.startsWith("\\")) {
        break;
      }
    }

    const deleted = file.editKind === "deleted" || (newRange.count === 0 && file.editKind !== "added");
    const locationRange = deleted ? oldRange : newRange;
    const locationStart = Math.max(1, locationRange.start);
    const locationEnd = Math.max(locationStart, locationRange.start + Math.max(1, locationRange.count) - 1);
    const path = file.path;
    hunks.push({
      id: `${path}:${newRange.start}:${oldRange.start}:${index++}`,
      path,
      header: line,
      oldRange,
      newRange,
      location: {
        path,
        side: deleted ? "old" : "current",
        start: locationStart,
        end: locationEnd,
        deleted,
      },
      lines: changedLines,
      editKind: file.editKind,
      binary: file.binary,
      generated: false,
    });
    file.hunkCount += 1;
    cursor = inner - 1;
  }

  finalizeFile();
  return hunks;
}
