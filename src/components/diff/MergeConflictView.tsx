import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
  type UIEvent,
} from "react";
import { useAppStore } from "../../stores/appStore";
import {
  alignLines,
  annotateMergedLines,
  applyHunkChoices,
  conflictLineMap,
  parseConflictHunks,
  sideHighlights,
  stripConflictMarkers,
  type AlignRow,
  type HunkChoice,
} from "../../lib/conflictParse";
import { highlightCodeLine } from "../../lib/syntaxHighlight";

const LINE_H = 18;
const FONT =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

/**
 * GitKraken-style 3-way conflict editor with aligned Ours/Theirs diff.
 */
export function MergeConflictView() {
  const {
    conflictPath,
    conflictDraft,
    conflictOurs,
    conflictTheirs,
    setConflictDraft,
    resolveConflict,
    clearConflictView,
    loadConflictFile,
    status,
    busy,
  } = useAppStore();

  const oursRef = useRef<HTMLDivElement>(null);
  const theirsRef = useRef<HTMLDivElement>(null);
  const outputHighlightRef = useRef<HTMLDivElement>(null);
  const outputEditRef = useRef<HTMLTextAreaElement>(null);
  const syncLock = useRef(false);

  const [activeConflict, setActiveConflict] = useState(0);
  const [choices, setChoices] = useState<Record<number, HunkChoice>>({});
  const [baseMerged, setBaseMerged] = useState(conflictDraft);
  const openedPathRef = useRef<string | null>(null);

  const hunks = useMemo(() => parseConflictHunks(baseMerged), [baseMerged]);
  const annotated = useMemo(() => annotateMergedLines(conflictDraft), [conflictDraft]);
  const oursLines = useMemo(() => (conflictOurs || "").split("\n"), [conflictOurs]);
  const theirsLines = useMemo(
    () => (conflictTheirs || "").split("\n"),
    [conflictTheirs],
  );
  const oursMarks = useMemo(
    () => sideHighlights(conflictOurs || "", hunks, "ours"),
    [conflictOurs, hunks],
  );
  const theirsMarks = useMemo(
    () => sideHighlights(conflictTheirs || "", hunks, "theirs"),
    [conflictTheirs, hunks],
  );

  const aligned = useMemo(() => {
    const leftMap = conflictLineMap(oursMarks);
    const rightMap = conflictLineMap(theirsMarks);
    return alignLines(oursLines, theirsLines, leftMap, rightMap);
  }, [oursLines, theirsLines, oursMarks, theirsMarks]);

  /** First aligned row index for each conflict (for jump + checkbox). */
  const conflictRowIndex = useMemo(() => {
    const map = new Map<number, number>();
    aligned.forEach((row, idx) => {
      if (row.conflictIndex !== null && !map.has(row.conflictIndex)) {
        map.set(row.conflictIndex, idx);
      }
    });
    return map;
  }, [aligned]);

  const conflicts = status?.conflicts ?? [];
  const branch = status?.branch ?? "HEAD";

  useEffect(() => {
    if (!conflictPath) {
      openedPathRef.current = null;
      return;
    }
    if (openedPathRef.current === conflictPath) return;
    openedPathRef.current = conflictPath;
    setActiveConflict(0);
    setChoices({});
    setBaseMerged(conflictDraft);
  }, [conflictPath, conflictDraft]);

  const syncScroll = useCallback((source: HTMLElement, top: number, left: number) => {
    if (syncLock.current) return;
    syncLock.current = true;
    for (const el of [
      oursRef.current,
      theirsRef.current,
      outputHighlightRef.current,
      outputEditRef.current,
    ]) {
      if (!el || el === source) continue;
      el.scrollTop = top;
      el.scrollLeft = left;
    }
    syncLock.current = false;
  }, []);

  const onPaneScroll = (e: UIEvent<HTMLDivElement>) => {
    const t = e.currentTarget;
    syncScroll(t, t.scrollTop, t.scrollLeft);
  };

  const onOutputEditScroll = (e: UIEvent<HTMLTextAreaElement>) => {
    const t = e.currentTarget;
    syncScroll(t, t.scrollTop, t.scrollLeft);
  };

  const jumpToConflict = useCallback(
    (index: number) => {
      if (hunks.length === 0) return;
      const idx = ((index % hunks.length) + hunks.length) % hunks.length;
      setActiveConflict(idx);
      const row = conflictRowIndex.get(idx) ?? hunks[idx]?.startLine ?? 0;
      const top = Math.max(0, row * LINE_H - 48);
      for (const el of [
        oursRef.current,
        theirsRef.current,
        outputHighlightRef.current,
        outputEditRef.current,
      ]) {
        if (!el) continue;
        el.scrollTop = top;
      }
    },
    [hunks, conflictRowIndex],
  );

  const toggleChoice = (conflictIndex: number, side: "ours" | "theirs") => {
    setChoices((prev) => {
      const cur = prev[conflictIndex];
      let next: HunkChoice | undefined;
      if (side === "ours") {
        if (cur === "ours") next = undefined;
        else if (cur === "theirs") next = "both";
        else if (cur === "both") next = "theirs";
        else next = "ours";
      } else if (cur === "theirs") next = undefined;
      else if (cur === "ours") next = "both";
      else if (cur === "both") next = "ours";
      else next = "theirs";

      const updated = { ...prev };
      if (next) updated[conflictIndex] = next;
      else delete updated[conflictIndex];

      setConflictDraft(applyHunkChoices(baseMerged, updated));
      return updated;
    });
  };

  if (!conflictPath) return null;

  const conflictCount = hunks.length;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#0d1117]">
      <div className="flex shrink-0 items-center gap-2 border-b border-[#2d3139] bg-[#161b22] px-3 py-1.5">
        <span className="min-w-0 flex-1 truncate text-[12px] text-[#e6edf3]">
          {conflictPath}
          {conflictCount > 0 && (
            <span className="ml-1.5 text-[#e3b341]">
              ({conflictCount} conflict{conflictCount === 1 ? "" : "s"})
            </span>
          )}
        </span>

        {conflicts.length > 1 && (
          <select
            className="max-w-[220px] truncate rounded border border-[#30363d] bg-[#0d1117] px-2 py-1 text-[11px] text-[#c9d1d9] outline-none"
            value={conflictPath}
            onChange={(e) => void loadConflictFile(e.target.value)}
            aria-label="Conflicted file"
          >
            {conflicts.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={() => {
            const next = conflictOurs || stripConflictMarkers(baseMerged, "ours");
            setBaseMerged(next);
            setConflictDraft(next);
            setChoices({});
          }}
          className="rounded border border-[#388bfd]/40 px-2 py-1 text-[11px] text-[#58a6ff] hover:bg-[#388bfd]/15 disabled:opacity-40"
        >
          Take Ours
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            const next = conflictTheirs || stripConflictMarkers(baseMerged, "theirs");
            setBaseMerged(next);
            setConflictDraft(next);
            setChoices({});
          }}
          className="rounded border border-[#e3b341]/40 px-2 py-1 text-[11px] text-[#e8c547] hover:bg-[#e3b341]/10 disabled:opacity-40"
        >
          Take Theirs
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void resolveConflict(conflictPath, "content", conflictDraft)}
          className="rounded bg-[#238636] px-2.5 py-1 text-[11px] font-medium text-white hover:bg-[#2ea043] disabled:opacity-40"
        >
          Save
        </button>
        <button
          type="button"
          className="px-1.5 text-[14px] text-[#8b909a] hover:text-[#e8eaed]"
          aria-label="Close"
          onClick={() => clearConflictView()}
        >
          ×
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-px bg-[#21262d]">
        <div className="grid min-h-0 grid-cols-2 gap-px">
          <AlignedPane
            title={`[A] Ours · ${branch}`}
            accent="ours"
            rows={aligned}
            activeConflict={activeConflict}
            choices={choices}
            checkboxRows={conflictRowIndex}
            onToggle={(ci) => toggleChoice(ci, "ours")}
            scrollRef={oursRef}
            onScroll={onPaneScroll}
          />
          <AlignedPane
            title="[B] Theirs · incoming"
            accent="theirs"
            rows={aligned}
            activeConflict={activeConflict}
            choices={choices}
            checkboxRows={conflictRowIndex}
            onToggle={(ci) => toggleChoice(ci, "theirs")}
            scrollRef={theirsRef}
            onScroll={onPaneScroll}
          />
        </div>

        <div className="flex min-h-0 flex-col bg-[#0d1117]">
          <div className="flex shrink-0 items-center justify-between border-b border-[#21262d] bg-[#161b22] px-2 py-1">
            <span className="text-[11px] font-medium text-[#c9d1d9]">Output</span>
            {conflictCount > 0 && (
              <div className="flex items-center gap-1 text-[11px] text-[#8b909a]">
                <span>
                  conflict {Math.min(activeConflict + 1, conflictCount)} of{" "}
                  {conflictCount}
                </span>
                <button
                  type="button"
                  className="rounded border border-[#30363d] px-1.5 hover:bg-[#21262d]"
                  onClick={() => jumpToConflict(activeConflict - 1)}
                  aria-label="Previous conflict"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="rounded border border-[#30363d] px-1.5 hover:bg-[#21262d]"
                  onClick={() => jumpToConflict(activeConflict + 1)}
                  aria-label="Next conflict"
                >
                  ↓
                </button>
              </div>
            )}
          </div>

          <div className="relative min-h-0 flex-1">
            <div
              ref={outputHighlightRef}
              className="pointer-events-none absolute inset-0 overflow-auto"
              aria-hidden
            >
              <OutputHighlightLayer
                annotated={annotated}
                activeConflict={activeConflict}
              />
            </div>
            <textarea
              ref={outputEditRef}
              className="absolute inset-0 z-10 min-h-0 w-full resize-none overflow-auto bg-transparent pl-[52px] pr-3 pt-0 font-mono text-[12px] text-transparent caret-[#e6edf3] outline-none"
              style={{ lineHeight: `${LINE_H}px`, fontFamily: FONT }}
              value={conflictDraft}
              onChange={(e) => {
                const v = e.target.value;
                setBaseMerged(v);
                setConflictDraft(v);
                setChoices({});
              }}
              onScroll={onOutputEditScroll}
              spellCheck={false}
              aria-label={`Resolved output for ${conflictPath}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function AlignedPane({
  title,
  accent,
  rows,
  activeConflict,
  choices,
  checkboxRows,
  onToggle,
  scrollRef,
  onScroll,
}: {
  title: string;
  accent: "ours" | "theirs";
  rows: AlignRow[];
  activeConflict: number;
  choices: Record<number, HunkChoice>;
  checkboxRows: Map<number, number>;
  onToggle: (conflictIndex: number) => void;
  scrollRef: RefObject<HTMLDivElement | null>;
  onScroll: (e: UIEvent<HTMLDivElement>) => void;
}) {
  const header =
    accent === "ours"
      ? "bg-[#1f6feb]/15 text-[#58a6ff]"
      : "bg-[#9e6a03]/20 text-[#e3b341]";

  const checkboxAtRow = useMemo(() => {
    const map = new Map<number, number>();
    for (const [ci, rowIdx] of checkboxRows) map.set(rowIdx, ci);
    return map;
  }, [checkboxRows]);

  return (
    <div className="flex min-h-0 flex-col bg-[#0d1117]">
      <div
        className={`shrink-0 border-b border-[#21262d] px-2 py-1 text-[11px] font-medium ${header}`}
      >
        {title}
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto" onScroll={onScroll}>
        <div className="min-w-max">
          {rows.map((row, i) => {
            const text = accent === "ours" ? row.leftText : row.rightText;
            const lineNo = accent === "ours" ? row.leftLine : row.rightLine;
            const isEmpty = text === null;
            const inConflict = row.conflictIndex !== null;
            const isActive = row.conflictIndex === activeConflict;
            const conflictIndex = checkboxAtRow.get(i);
            const checked =
              conflictIndex !== undefined &&
              (choices[conflictIndex] === accent || choices[conflictIndex] === "both");

            // Diff colors: always show A/B differences; boost when conflict
            let bg = "transparent";
            if (isEmpty) {
              bg =
                accent === "ours"
                  ? "rgba(210, 153, 34, 0.08)" // gap where theirs has content
                  : "rgba(56, 139, 253, 0.08)";
            } else if (row.kind === "change" || row.kind === "leftOnly" || row.kind === "rightOnly") {
              if (accent === "ours") {
                bg = inConflict
                  ? isActive
                    ? "rgba(56, 139, 253, 0.32)"
                    : "rgba(56, 139, 253, 0.18)"
                  : "rgba(56, 139, 253, 0.12)";
              } else {
                bg = inConflict
                  ? isActive
                    ? "rgba(210, 153, 34, 0.32)"
                    : "rgba(210, 153, 34, 0.18)"
                  : "rgba(210, 153, 34, 0.12)";
              }
            } else if (inConflict) {
              bg =
                accent === "ours"
                  ? isActive
                    ? "rgba(56, 139, 253, 0.22)"
                    : "rgba(56, 139, 253, 0.1)"
                  : isActive
                    ? "rgba(210, 153, 34, 0.22)"
                    : "rgba(210, 153, 34, 0.1)";
            }

            return (
              <div key={i} className="flex" style={{ height: LINE_H, background: bg }}>
                <div
                  className="flex w-[52px] shrink-0 select-none items-center justify-end gap-1 border-r border-[#21262d] bg-[#0d1117]/80 pr-1.5 text-[10px] text-[#484f58]"
                  style={{ height: LINE_H }}
                >
                  {conflictIndex !== undefined ? (
                    <input
                      type="checkbox"
                      className="h-3 w-3 accent-[#58a6ff]"
                      checked={checked}
                      onChange={() => onToggle(conflictIndex)}
                      title={
                        accent === "ours"
                          ? "Use ours for this conflict"
                          : "Use theirs for this conflict"
                      }
                    />
                  ) : (
                    <span className="inline-block w-3" />
                  )}
                  <span className="tabular-nums w-5 text-right">
                    {lineNo !== null ? lineNo + 1 : ""}
                  </span>
                </div>
                <pre
                  className={`m-0 flex-1 overflow-hidden whitespace-pre px-3 text-[12px] ${
                    isEmpty ? "opacity-30" : ""
                  }`}
                  style={{
                    lineHeight: `${LINE_H}px`,
                    fontFamily: FONT,
                    height: LINE_H,
                  }}
                >
                  {isEmpty
                    ? "\u00a0"
                    : highlightCodeLine(text, `${accent}-${i}`) || "\u00a0"}
                </pre>
              </div>
            );
          })}
          {rows.length === 0 && (
            <div className="px-3 py-2 text-[11px] text-[#8b909a]">(vazio)</div>
          )}
        </div>
      </div>
    </div>
  );
}

function OutputHighlightLayer({
  annotated,
  activeConflict,
}: {
  annotated: ReturnType<typeof annotateMergedLines>;
  activeConflict: number;
}) {
  return (
    <div className="min-w-max pb-8">
      {annotated.map((row, i) => {
        const isActive = row.conflictIndex === activeConflict;
        let bg = "transparent";
        if (row.kind === "marker" || row.kind === "separator") {
          bg = isActive ? "rgba(163, 113, 247, 0.35)" : "rgba(163, 113, 247, 0.2)";
        } else if (row.kind === "ours") {
          bg = isActive ? "rgba(56, 139, 253, 0.22)" : "rgba(56, 139, 253, 0.12)";
        } else if (row.kind === "theirs") {
          bg = isActive ? "rgba(210, 153, 34, 0.22)" : "rgba(210, 153, 34, 0.12)";
        }

        const isMarker = row.kind === "marker" || row.kind === "separator";

        return (
          <div key={i} className="flex" style={{ height: LINE_H, background: bg }}>
            <div
              className="flex w-[52px] shrink-0 select-none items-center justify-end border-r border-[#21262d] bg-[#0d1117]/80 pr-2 text-[10px] tabular-nums text-[#484f58]"
              style={{ height: LINE_H }}
            >
              {i + 1}
            </div>
            <pre
              className="m-0 flex-1 overflow-hidden whitespace-pre px-3 text-[12px]"
              style={{
                lineHeight: `${LINE_H}px`,
                fontFamily: FONT,
                height: LINE_H,
              }}
            >
              {isMarker ? (
                <span className="text-[#d2a8ff]">{row.text || "\u00a0"}</span>
              ) : (
                ((highlightCodeLine(row.text, `out-${i}`) as ReactNode) || "\u00a0")
              )}
            </pre>
          </div>
        );
      })}
    </div>
  );
}
