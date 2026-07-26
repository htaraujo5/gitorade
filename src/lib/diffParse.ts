/** Parsed unified-diff rows for unified or side-by-side rendering. */

export type DiffRowKind = "context" | "add" | "del" | "meta" | "hunk";

export type DiffRow = {
  kind: DiffRowKind;
  text: string;
  oldLine?: number;
  newLine?: number;
};

export type SplitRow = {
  left: { text: string; kind: DiffRowKind; line?: number } | null;
  right: { text: string; kind: DiffRowKind; line?: number } | null;
};

/** Parse a unified diff string into annotated rows. */
export function parseUnifiedDiff(diffText: string): DiffRow[] {
  const rows: DiffRow[] = [];
  let oldLine = 0;
  let newLine = 0;

  for (const line of diffText.split("\n")) {
    if (line.startsWith("@@")) {
      const m = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
      if (m) {
        oldLine = Number(m[1]);
        newLine = Number(m[2]);
      }
      rows.push({ kind: "hunk", text: line });
      continue;
    }

    if (
      line.startsWith("diff ") ||
      line.startsWith("index ") ||
      line.startsWith("--- ") ||
      line.startsWith("+++ ") ||
      line.startsWith("new file") ||
      line.startsWith("deleted file") ||
      line.startsWith("similarity ") ||
      line.startsWith("rename ") ||
      line.startsWith("Binary ")
    ) {
      rows.push({ kind: "meta", text: line });
      continue;
    }

    if (line.startsWith("+")) {
      rows.push({ kind: "add", text: line.slice(1), newLine });
      newLine += 1;
      continue;
    }

    if (line.startsWith("-")) {
      rows.push({ kind: "del", text: line.slice(1), oldLine });
      oldLine += 1;
      continue;
    }

    // Context line (leading space optional when empty)
    const text = line.startsWith(" ") ? line.slice(1) : line;
    rows.push({ kind: "context", text, oldLine, newLine });
    oldLine += 1;
    newLine += 1;
  }

  return rows;
}

/**
 * Pair deleted/added lines within a hunk into side-by-side rows.
 * Consecutive dels followed by adds are aligned; leftovers get empty opposite cells.
 */
export function toSplitRows(rows: DiffRow[]): SplitRow[] {
  const out: SplitRow[] = [];
  let i = 0;

  while (i < rows.length) {
    const row = rows[i];

    if (row.kind === "meta" || row.kind === "hunk") {
      out.push({
        left: { text: row.text, kind: row.kind },
        right: { text: row.text, kind: row.kind },
      });
      i += 1;
      continue;
    }

    if (row.kind === "context") {
      out.push({
        left: { text: row.text, kind: "context", line: row.oldLine },
        right: { text: row.text, kind: "context", line: row.newLine },
      });
      i += 1;
      continue;
    }

    // Collect a run of dels then adds
    const dels: DiffRow[] = [];
    const adds: DiffRow[] = [];
    while (i < rows.length && rows[i].kind === "del") {
      dels.push(rows[i]);
      i += 1;
    }
    while (i < rows.length && rows[i].kind === "add") {
      adds.push(rows[i]);
      i += 1;
    }

    const n = Math.max(dels.length, adds.length);
    for (let k = 0; k < n; k += 1) {
      const d = dels[k];
      const a = adds[k];
      out.push({
        left: d
          ? { text: d.text, kind: "del", line: d.oldLine }
          : null,
        right: a
          ? { text: a.text, kind: "add", line: a.newLine }
          : null,
      });
    }
  }

  return out;
}
