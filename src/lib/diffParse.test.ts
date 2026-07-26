import { describe, expect, it } from "vitest";
import { parseUnifiedDiff, toSplitRows } from "./diffParse";

const SAMPLE = `diff --git a/a.txt b/a.txt
index 111..222 100644
--- a/a.txt
+++ b/a.txt
@@ -1,3 +1,3 @@
 line1
-old
+new
 line3
`;

describe("diffParse", () => {
  it("parses unified rows with line numbers", () => {
    const rows = parseUnifiedDiff(SAMPLE);
    expect(rows.some((r) => r.kind === "hunk")).toBe(true);
    const del = rows.find((r) => r.kind === "del");
    const add = rows.find((r) => r.kind === "add");
    expect(del?.text).toBe("old");
    expect(add?.text).toBe("new");
    expect(del?.oldLine).toBe(2);
    expect(add?.newLine).toBe(2);
  });

  it("pairs dels and adds for side-by-side", () => {
    const split = toSplitRows(parseUnifiedDiff(SAMPLE));
    const change = split.find((r) => r.left?.kind === "del" || r.right?.kind === "add");
    expect(change?.left?.text).toBe("old");
    expect(change?.right?.text).toBe("new");
  });
});
