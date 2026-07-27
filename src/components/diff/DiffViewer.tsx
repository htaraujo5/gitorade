import { useMemo, useState, type ReactNode } from "react";
import { parseUnifiedDiff, toSplitRows, type DiffRowKind } from "../../lib/diffParse";
import { CodeLine } from "./CodeEditorView";

type Props = {
  selectedFile: { path: string; staged: boolean } | null;
  diffText: string;
  stagedCount: number;
  unstagedCount: number;
  lastCommitLabel?: string | null;
};

export function DiffViewer({
  selectedFile,
  diffText,
  stagedCount,
  unstagedCount,
  lastCommitLabel,
}: Props) {
  const [mode, setMode] = useState<"unified" | "split">("split");
  const rows = useMemo(() => parseUnifiedDiff(diffText), [diffText]);
  const split = useMemo(() => toSplitRows(rows), [rows]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted">
        <div>
          {stagedCount} staged · {unstagedCount} unstaged
          {lastCommitLabel && (
            <span className="ml-2 text-success">último: {lastCommitLabel}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {selectedFile && (
            <div className="font-mono text-text">
              {selectedFile.staged ? "staged" : "unstaged"} · {selectedFile.path}
            </div>
          )}
          {selectedFile && diffText.trim() !== "" && (
            <div
              className="inline-flex rounded-[var(--radius-sm)] border border-border p-0.5"
              role="group"
              aria-label="Modo do diff"
            >
              <ModeBtn active={mode === "split"} onClick={() => setMode("split")}>
                Lado a lado
              </ModeBtn>
              <ModeBtn active={mode === "unified"} onClick={() => setMode("unified")}>
                Unificado
              </ModeBtn>
            </div>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-[var(--radius-md)] border border-border bg-[#0d1117]">
        {!selectedFile ? (
          <div className="p-6 text-sm text-text-muted">
            Selecione um arquivo no painel Changes para ver o diff.
          </div>
        ) : diffText.trim() === "" ? (
          <div className="p-6 text-sm text-text-muted">
            Sem diff textual (arquivo binário, novo sem conteúdo comparado, ou sem mudanças).
          </div>
        ) : mode === "unified" ? (
          <UnifiedView rows={rows} />
        ) : (
          <SplitView rows={split} />
        )}
      </div>
    </div>
  );
}

function ModeBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-[4px] px-2 py-1 text-[11px] transition ${
        active ? "bg-surface text-text" : "text-text-muted hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}

function UnifiedView({ rows }: { rows: ReturnType<typeof parseUnifiedDiff> }) {
  return (
    <pre className="p-0 font-mono text-[12px] leading-5" aria-label="Diff unificado">
      {rows.map((row, i) => (
        <div key={i} className={`flex ${rowClass(row.kind)}`}>
          <span className="w-10 shrink-0 select-none px-1 text-right text-[#484f58]">
            {row.oldLine ?? ""}
          </span>
          <span className="w-10 shrink-0 select-none px-1 text-right text-[#484f58]">
            {row.newLine ?? ""}
          </span>
          <span className="w-4 shrink-0 select-none text-center text-[#8b909a]">
            {row.kind === "add" ? "+" : row.kind === "del" ? "−" : " "}
          </span>
          {row.kind === "hunk" || row.kind === "meta" ? (
            <span className="min-w-0 flex-1 whitespace-pre-wrap break-all">
              {row.text || " "}
            </span>
          ) : (
            <CodeLine text={row.text} lineKey={`du-${i}`} />
          )}
        </div>
      ))}
    </pre>
  );
}

function SplitView({ rows }: { rows: ReturnType<typeof toSplitRows> }) {
  return (
    <div className="grid grid-cols-2 font-mono text-[12px] leading-5" aria-label="Diff lado a lado">
      <div className="border-r border-[#2d3139]">
        <div className="sticky top-0 z-10 border-b border-[#2d3139] bg-[#161b22] px-3 py-1 text-[10px] uppercase tracking-wide text-[#8b909a]">
          Antes
        </div>
        {rows.map((row, i) => (
          <SplitCell key={`l-${i}`} cell={row.left} lineKey={`dl-${i}`} />
        ))}
      </div>
      <div>
        <div className="sticky top-0 z-10 border-b border-[#2d3139] bg-[#161b22] px-3 py-1 text-[10px] uppercase tracking-wide text-[#8b909a]">
          Depois
        </div>
        {rows.map((row, i) => (
          <SplitCell key={`r-${i}`} cell={row.right} lineKey={`dr-${i}`} />
        ))}
      </div>
    </div>
  );
}

function SplitCell({
  cell,
  lineKey,
}: {
  cell: { text: string; kind: DiffRowKind; line?: number } | null;
  lineKey: string;
}) {
  if (!cell) {
    return <div className="min-h-[20px] bg-[#010409]/50 px-2">&nbsp;</div>;
  }
  return (
    <div className={`flex min-h-[20px] ${rowClass(cell.kind)}`}>
      <span className="w-10 shrink-0 select-none px-1 text-right text-[#484f58]">
        {cell.line ?? ""}
      </span>
      {cell.kind === "hunk" || cell.kind === "meta" ? (
        <span className="min-w-0 flex-1 whitespace-pre-wrap break-all px-1">
          {cell.text || " "}
        </span>
      ) : (
        <span className="px-1">
          <CodeLine text={cell.text} lineKey={lineKey} />
        </span>
      )}
    </div>
  );
}

function rowClass(kind: DiffRowKind): string {
  switch (kind) {
    case "add":
      return "bg-[#238636]/15";
    case "del":
      return "bg-[#da3633]/15";
    case "hunk":
      return "bg-[#1e3a5f]/40 text-[#8bb4f0]";
    case "meta":
      return "text-[#5c6370]";
    default:
      return "";
  }
}
