/** Parse / rebuild git conflict markers for the 3-way merge UI. */

export type ConflictHunk = {
  index: number;
  /** 0-based line of `<<<<<<<` in merged text */
  startLine: number;
  /** 0-based line of `>>>>>>>` in merged text (inclusive) */
  endLine: number;
  oursLabel: string;
  theirsLabel: string;
  oursLines: string[];
  theirsLines: string[];
};

export type LineKind = "normal" | "marker" | "ours" | "theirs" | "separator";

export type AnnotatedLine = {
  text: string;
  kind: LineKind;
  /** Conflict index when inside a conflict region (including markers). */
  conflictIndex: number | null;
};

/** Count git conflict marker blocks in a file. */
export function countConflictMarkers(text: string): number {
  const matches = text.match(/^<<<<<<</gm);
  return matches?.length ?? 0;
}

/** Line indices (0-based) where a conflict block starts (`<<<<<<<`). */
export function conflictStartLines(text: string): number[] {
  return parseConflictHunks(text).map((h) => h.startLine);
}

export function parseConflictHunks(text: string): ConflictHunk[] {
  const lines = text.split("\n");
  const hunks: ConflictHunk[] = [];
  let i = 0;
  let index = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.startsWith("<<<<<<<")) {
      i += 1;
      continue;
    }

    const startLine = i;
    const oursLabel = line.replace(/^<<<<<<<\s?/, "").trim() || "ours";
    i += 1;
    const oursLines: string[] = [];
    while (i < lines.length && !lines[i].startsWith("=======")) {
      oursLines.push(lines[i]);
      i += 1;
    }
    if (i >= lines.length) break;
    i += 1; // =======
    const theirsLines: string[] = [];
    while (i < lines.length && !lines[i].startsWith(">>>>>>>")) {
      theirsLines.push(lines[i]);
      i += 1;
    }
    if (i >= lines.length) break;
    const theirsLabel = lines[i].replace(/^>>>>>>>\s?/, "").trim() || "theirs";
    const endLine = i;
    hunks.push({
      index,
      startLine,
      endLine,
      oursLabel,
      theirsLabel,
      oursLines,
      theirsLines,
    });
    index += 1;
    i += 1;
  }

  return hunks;
}

export function annotateMergedLines(text: string): AnnotatedLine[] {
  const lines = text.split("\n");
  const out: AnnotatedLine[] = [];
  let mode: "normal" | "ours" | "theirs" = "normal";
  let conflictIndex: number | null = null;
  let nextIndex = 0;

  for (const line of lines) {
    if (line.startsWith("<<<<<<<")) {
      mode = "ours";
      conflictIndex = nextIndex;
      nextIndex += 1;
      out.push({ text: line, kind: "marker", conflictIndex });
      continue;
    }
    if (line.startsWith("=======") && mode === "ours") {
      mode = "theirs";
      out.push({ text: line, kind: "separator", conflictIndex });
      continue;
    }
    if (line.startsWith(">>>>>>>") && (mode === "ours" || mode === "theirs")) {
      out.push({ text: line, kind: "marker", conflictIndex });
      mode = "normal";
      conflictIndex = null;
      continue;
    }
    if (mode === "ours") {
      out.push({ text: line, kind: "ours", conflictIndex });
    } else if (mode === "theirs") {
      out.push({ text: line, kind: "theirs", conflictIndex });
    } else {
      out.push({ text: line, kind: "normal", conflictIndex: null });
    }
  }

  return out;
}

/**
 * Find start line (0-based) of `needle` lines as a contiguous block inside `haystack`.
 * Returns -1 if not found.
 */
export function findBlockStart(haystack: string[], needle: string[]): number {
  if (needle.length === 0) return -1;
  for (let i = 0; i <= haystack.length - needle.length; i++) {
    let ok = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return i;
  }
  return -1;
}

export type SideHighlight = {
  conflictIndex: number;
  startLine: number;
  endLine: number; // exclusive
};

export function sideHighlights(
  sideText: string,
  hunks: ConflictHunk[],
  side: "ours" | "theirs",
): SideHighlight[] {
  const lines = sideText.split("\n");
  const used = new Set<number>();
  const result: SideHighlight[] = [];

  for (const hunk of hunks) {
    const needle = side === "ours" ? hunk.oursLines : hunk.theirsLines;
    if (needle.length === 0) continue;
    // Prefer first unused match
    let start = -1;
    for (let i = 0; i <= lines.length - needle.length; i++) {
      if (used.has(i)) continue;
      let ok = true;
      for (let j = 0; j < needle.length; j++) {
        if (lines[i + j] !== needle[j]) {
          ok = false;
          break;
        }
      }
      if (ok) {
        start = i;
        break;
      }
    }
    if (start < 0) continue;
    const end = start + needle.length;
    for (let i = start; i < end; i++) used.add(i);
    result.push({ conflictIndex: hunk.index, startLine: start, endLine: end });
  }

  return result;
}

export type HunkChoice = "ours" | "theirs" | "both";

/** Rebuild merged text applying per-hunk choices (drops markers). */
export function applyHunkChoices(text: string, choices: Record<number, HunkChoice>): string {
  const hunks = parseConflictHunks(text);
  if (hunks.length === 0) return text;

  const lines = text.split("\n");
  const out: string[] = [];
  let cursor = 0;

  for (const hunk of hunks) {
    out.push(...lines.slice(cursor, hunk.startLine));
    const choice = choices[hunk.index];
    if (choice === "ours") out.push(...hunk.oursLines);
    else if (choice === "theirs") out.push(...hunk.theirsLines);
    else if (choice === "both") out.push(...hunk.oursLines, ...hunk.theirsLines);
    else {
      // keep markers unresolved
      out.push(...lines.slice(hunk.startLine, hunk.endLine + 1));
    }
    cursor = hunk.endLine + 1;
  }
  out.push(...lines.slice(cursor));
  return out.join("\n");
}

/** Strip conflict markers, preferring ours / theirs / both. */
export function stripConflictMarkers(
  text: string,
  prefer: "ours" | "theirs" | "both" = "ours",
): string {
  const hunks = parseConflictHunks(text);
  if (hunks.length === 0) return text;
  const choices: Record<number, HunkChoice> = {};
  for (const h of hunks) choices[h.index] = prefer;
  return applyHunkChoices(text, choices);
}

export function fileExt(path: string): string {
  const base = path.split(/[/\\]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot >= 0 ? base.slice(dot + 1).toLowerCase() : "";
}

export type AlignKind = "equal" | "change" | "leftOnly" | "rightOnly";

export type AlignRow = {
  kind: AlignKind;
  /** Original 0-based line index on left (ours), if present. */
  leftLine: number | null;
  rightLine: number | null;
  leftText: string | null;
  rightText: string | null;
  /** Conflict hunk covering this row on either side, if any. */
  conflictIndex: number | null;
};

/**
 * Align two files line-by-line (LCS) so inserts/deletes line up with empty
 * placeholders — makes Ours vs Theirs differences obvious while scrolling.
 */
export function alignLines(
  left: string[],
  right: string[],
  leftConflictByLine: Map<number, number>,
  rightConflictByLine: Map<number, number>,
): AlignRow[] {
  const n = left.length;
  const m = right.length;

  // Guard huge files: fall back to naive zip
  if (n * m > 2_500_000) {
    return naiveAlign(left, right, leftConflictByLine, rightConflictByLine);
  }

  // LCS lengths (rolling two rows to save memory still need full for backtrack —
  // use full DP for clarity; cap already applied)
  const dp: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (left[i] === right[j]) dp[i]![j] = (dp[i + 1]![j + 1]! + 1) as number;
      else dp[i]![j] = Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!) as number;
    }
  }

  const rows: AlignRow[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (left[i] === right[j]) {
      const ci = leftConflictByLine.get(i) ?? rightConflictByLine.get(j) ?? null;
      rows.push({
        kind: "equal",
        leftLine: i,
        rightLine: j,
        leftText: left[i]!,
        rightText: right[j]!,
        conflictIndex: ci,
      });
      i += 1;
      j += 1;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      rows.push({
        kind: "leftOnly",
        leftLine: i,
        rightLine: null,
        leftText: left[i]!,
        rightText: null,
        conflictIndex: leftConflictByLine.get(i) ?? null,
      });
      i += 1;
    } else {
      rows.push({
        kind: "rightOnly",
        leftLine: null,
        rightLine: j,
        leftText: null,
        rightText: right[j]!,
        conflictIndex: rightConflictByLine.get(j) ?? null,
      });
      j += 1;
    }
  }
  while (i < n) {
    rows.push({
      kind: "leftOnly",
      leftLine: i,
      rightLine: null,
      leftText: left[i]!,
      rightText: null,
      conflictIndex: leftConflictByLine.get(i) ?? null,
    });
    i += 1;
  }
  while (j < m) {
    rows.push({
      kind: "rightOnly",
      leftLine: null,
      rightLine: j,
      leftText: null,
      rightText: right[j]!,
      conflictIndex: rightConflictByLine.get(j) ?? null,
    });
    j += 1;
  }

  // Pair adjacent leftOnly + rightOnly into "change" when they sit next to each other
  return coalesceChanges(rows);
}

function coalesceChanges(rows: AlignRow[]): AlignRow[] {
  const out: AlignRow[] = [];
  let i = 0;
  while (i < rows.length) {
    if (rows[i]!.kind === "leftOnly") {
      const lefts: AlignRow[] = [];
      while (i < rows.length && rows[i]!.kind === "leftOnly") {
        lefts.push(rows[i]!);
        i += 1;
      }
      const rights: AlignRow[] = [];
      while (i < rows.length && rows[i]!.kind === "rightOnly") {
        rights.push(rows[i]!);
        i += 1;
      }
      const pair = Math.min(lefts.length, rights.length);
      for (let k = 0; k < pair; k++) {
        out.push({
          kind: "change",
          leftLine: lefts[k]!.leftLine,
          rightLine: rights[k]!.rightLine,
          leftText: lefts[k]!.leftText,
          rightText: rights[k]!.rightText,
          conflictIndex: lefts[k]!.conflictIndex ?? rights[k]!.conflictIndex,
        });
      }
      for (let k = pair; k < lefts.length; k++) out.push(lefts[k]!);
      for (let k = pair; k < rights.length; k++) out.push(rights[k]!);
      continue;
    }
    if (rows[i]!.kind === "rightOnly") {
      // rights without preceding lefts
      out.push(rows[i]!);
      i += 1;
      continue;
    }
    out.push(rows[i]!);
    i += 1;
  }
  return out;
}

function naiveAlign(
  left: string[],
  right: string[],
  leftConflictByLine: Map<number, number>,
  rightConflictByLine: Map<number, number>,
): AlignRow[] {
  const max = Math.max(left.length, right.length);
  const rows: AlignRow[] = [];
  for (let i = 0; i < max; i++) {
    const lt = i < left.length ? left[i]! : null;
    const rt = i < right.length ? right[i]! : null;
    let kind: AlignKind = "equal";
    if (lt === null) kind = "rightOnly";
    else if (rt === null) kind = "leftOnly";
    else if (lt !== rt) kind = "change";
    rows.push({
      kind,
      leftLine: lt !== null ? i : null,
      rightLine: rt !== null ? i : null,
      leftText: lt,
      rightText: rt,
      conflictIndex:
        (lt !== null ? leftConflictByLine.get(i) : undefined) ??
        (rt !== null ? rightConflictByLine.get(i) : undefined) ??
        null,
    });
  }
  return rows;
}

/** Map original line index → conflict index for a side. */
export function conflictLineMap(marks: SideHighlight[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const m of marks) {
    for (let i = m.startLine; i < m.endLine; i++) map.set(i, m.conflictIndex);
  }
  return map;
}
