/** Count git conflict marker blocks in a file. */
export function countConflictMarkers(text: string): number {
  const matches = text.match(/^<<<<<<< /gm);
  return matches?.length ?? 0;
}

/** Line indices (0-based) where a conflict block starts (`<<<<<<<`). */
export function conflictStartLines(text: string): number[] {
  const lines = text.split("\n");
  const starts: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("<<<<<<<")) starts.push(i);
  }
  return starts;
}

/** Strip conflict markers, preferring ours / theirs / both. */
export function stripConflictMarkers(
  text: string,
  prefer: "ours" | "theirs" | "both" = "ours",
): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let mode: "normal" | "ours" | "theirs" = "normal";

  for (const line of lines) {
    if (line.startsWith("<<<<<<<")) {
      mode = "ours";
      continue;
    }
    if (line.startsWith("=======") && mode === "ours") {
      mode = "theirs";
      continue;
    }
    if (line.startsWith(">>>>>>>") && (mode === "ours" || mode === "theirs")) {
      mode = "normal";
      continue;
    }
    if (mode === "normal") {
      out.push(line);
    } else if (mode === "ours" && (prefer === "ours" || prefer === "both")) {
      out.push(line);
    } else if (mode === "theirs" && (prefer === "theirs" || prefer === "both")) {
      out.push(line);
    }
  }
  return out.join("\n");
}
