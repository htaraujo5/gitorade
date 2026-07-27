import { describe, expect, it } from "vitest";
import {
  alignLines,
  annotateMergedLines,
  applyHunkChoices,
  conflictLineMap,
  parseConflictHunks,
  sideHighlights,
  stripConflictMarkers,
} from "./conflictParse";

const SAMPLE = `line1
<<<<<<< HEAD
ours-a
ours-b
=======
theirs-a
>>>>>>> feat
line2
<<<<<<< HEAD
only-ours
=======
only-theirs
>>>>>>> feat
`;

describe("conflictParse", () => {
  it("parses hunks", () => {
    const hunks = parseConflictHunks(SAMPLE);
    expect(hunks).toHaveLength(2);
    expect(hunks[0]?.oursLines).toEqual(["ours-a", "ours-b"]);
    expect(hunks[0]?.theirsLines).toEqual(["theirs-a"]);
  });

  it("annotates merged lines", () => {
    const rows = annotateMergedLines(SAMPLE);
    expect(rows.some((r) => r.kind === "ours")).toBe(true);
    expect(rows.some((r) => r.kind === "theirs")).toBe(true);
    expect(rows.some((r) => r.kind === "marker")).toBe(true);
  });

  it("applies choices", () => {
    const out = applyHunkChoices(SAMPLE, { 0: "ours", 1: "theirs" });
    expect(out).toContain("ours-a");
    expect(out).toContain("only-theirs");
    expect(out).not.toContain("<<<<<<<");
  });

  it("strips preferring ours", () => {
    const out = stripConflictMarkers(SAMPLE, "ours");
    expect(out).toContain("ours-a");
    expect(out).not.toContain("theirs-a");
  });

  it("finds side highlights", () => {
    const hunks = parseConflictHunks(SAMPLE);
    const ours = "line1\nours-a\nours-b\nline2\nonly-ours\n";
    const marks = sideHighlights(ours, hunks, "ours");
    expect(marks.length).toBeGreaterThan(0);
    expect(marks[0]?.startLine).toBe(1);
  });

  it("aligns differing sides with placeholders", () => {
    const left = ["a", "b", "c"];
    const right = ["a", "x", "c"];
    const rows = alignLines(left, right, conflictLineMap([]), conflictLineMap([]));
    expect(rows.some((r) => r.kind === "change")).toBe(true);
    expect(rows.find((r) => r.leftText === "a" && r.rightText === "a")?.kind).toBe(
      "equal",
    );
    const change = rows.find((r) => r.kind === "change");
    expect(change?.leftText).toBe("b");
    expect(change?.rightText).toBe("x");
  });
});
