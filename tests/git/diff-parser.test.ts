import { describe, expect, it } from "vitest";
import { parseUnifiedDiff } from "../../src/git/diff.js";

describe("unified diff parsing", () => {
  it("preserves exact current and deletion locations", () => {
    const hunks = parseUnifiedDiff(`diff --git a/src/core.ts b/src/core.ts
--- a/src/core.ts
+++ b/src/core.ts
@@ -10,2 +10,2 @@
-if (!enabled) return
+if (enabled) return
 run()
diff --git a/src/old.ts b/src/old.ts
deleted file mode 100644
--- a/src/old.ts
+++ /dev/null
@@ -4,2 +0,0 @@
-one
-two
`);

    expect(hunks).toHaveLength(2);
    expect(hunks[0]?.location).toEqual({
      path: "src/core.ts",
      side: "current",
      start: 10,
      end: 11,
      deleted: false,
    });
    expect(hunks[1]?.location).toEqual({
      path: "src/old.ts",
      side: "old",
      start: 4,
      end: 5,
      deleted: true,
    });
  });

  it("handles paths with spaces without treating them as commands", () => {
    const hunks = parseUnifiedDiff(`diff --git a/src/file name.ts b/src/file name.ts
--- a/src/file name.ts
+++ b/src/file name.ts
@@ -1 +1 @@
-false
+true
`);

    expect(hunks[0]?.path).toBe("src/file name.ts");
  });
});
