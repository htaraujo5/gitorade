import { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "../../stores/appStore";
import {
  conflictStartLines,
  countConflictMarkers,
  stripConflictMarkers,
} from "../../lib/conflictParse";

/**
 * Three-pane conflict editor: Ours | Theirs | Output (GitKraken-inspired).
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
    status,
    busy,
  } = useAppStore();

  const outputRef = useRef<HTMLTextAreaElement>(null);
  const [activeConflict, setActiveConflict] = useState(0);

  const starts = useMemo(() => conflictStartLines(conflictDraft), [conflictDraft]);
  const conflictCount = starts.length || countConflictMarkers(conflictDraft);

  useEffect(() => {
    setActiveConflict(0);
  }, [conflictPath]);

  useEffect(() => {
    if (!outputRef.current || starts.length === 0) return;
    const idx = Math.min(activeConflict, starts.length - 1);
    const line = starts[idx] ?? 0;
    const el = outputRef.current;
    const lineHeight = 16;
    el.scrollTop = Math.max(0, line * lineHeight - 40);
  }, [activeConflict, starts]);

  if (!conflictPath) return null;

  const branch = status?.branch ?? "HEAD";
  const goConflict = (delta: number) => {
    if (starts.length === 0) return;
    setActiveConflict((i) => (i + delta + starts.length) % starts.length);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#171a20]">
      <div className="flex shrink-0 items-center gap-2 border-b border-[#2d3139] bg-[#1c1f26] px-3 py-1.5">
        <span className="min-w-0 flex-1 truncate text-[12px] text-[#e8eaed]">
          {conflictPath}
          {conflictCount > 0 && (
            <span className="ml-1.5 text-[#e3b341]">
              ({conflictCount} conflict{conflictCount === 1 ? "" : "s"})
            </span>
          )}
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setConflictDraft(conflictOurs || stripConflictMarkers(conflictDraft, "ours"));
          }}
          className="rounded border border-[#388bfd]/40 px-2 py-1 text-[11px] text-[#58a6ff] hover:bg-[#388bfd]/15 disabled:opacity-40"
        >
          Take Ours
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setConflictDraft(conflictTheirs || stripConflictMarkers(conflictDraft, "theirs"));
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

      <div className="grid min-h-0 flex-1 grid-rows-[1fr_1fr] gap-px bg-[#2d3139]">
        <div className="grid min-h-0 grid-cols-2 gap-px">
          <Pane
            title={`[A] Ours · ${branch}`}
            accent="ours"
            value={conflictOurs || "(indisponível)"}
          />
          <Pane
            title="[B] Theirs · incoming"
            accent="theirs"
            value={conflictTheirs || "(indisponível)"}
          />
        </div>

        <div className="flex min-h-0 flex-col bg-[#171a20]">
          <div className="flex shrink-0 items-center justify-between border-b border-[#2d3139] bg-[#1c1f26] px-2 py-1">
            <span className="text-[11px] font-medium text-[#c9d1d9]">Output</span>
            {starts.length > 0 && (
              <div className="flex items-center gap-1 text-[11px] text-[#8b909a]">
                <span>
                  conflict {Math.min(activeConflict + 1, starts.length)} of {starts.length}
                </span>
                <button
                  type="button"
                  className="rounded border border-[#2d3139] px-1.5 hover:bg-[#252830]"
                  onClick={() => goConflict(-1)}
                  aria-label="Previous conflict"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="rounded border border-[#2d3139] px-1.5 hover:bg-[#252830]"
                  onClick={() => goConflict(1)}
                  aria-label="Next conflict"
                >
                  ↓
                </button>
              </div>
            )}
          </div>
          <textarea
            ref={outputRef}
            className="min-h-0 flex-1 resize-none bg-[#0d1117] p-2 font-mono text-[11px] leading-4 text-[#e6edf3] outline-none"
            value={conflictDraft}
            onChange={(e) => setConflictDraft(e.target.value)}
            spellCheck={false}
            aria-label={`Resolved output for ${conflictPath}`}
          />
        </div>
      </div>
    </div>
  );
}

function Pane({
  title,
  accent,
  value,
}: {
  title: string;
  accent: "ours" | "theirs";
  value: string;
}) {
  const header =
    accent === "ours"
      ? "border-[#388bfd]/40 bg-[#388bfd]/12 text-[#58a6ff]"
      : "border-[#e3b341]/40 bg-[#e3b341]/10 text-[#e8c547]";

  return (
    <div className="flex min-h-0 flex-col bg-[#171a20]">
      <div className={`shrink-0 border-b px-2 py-1 text-[11px] font-medium ${header}`}>
        {title}
      </div>
      <pre className="min-h-0 flex-1 overflow-auto p-2 font-mono text-[11px] leading-4 text-[#8b949e] whitespace-pre-wrap">
        {value}
      </pre>
    </div>
  );
}
