import { useMemo, useState, type ReactNode } from "react";
import { parseUnifiedDiff, toSplitRows, type DiffRowKind } from "../../lib/diffParse";

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

      <div className="min-h-0 flex-1 overflow-auto rounded-[var(--radius-md)] border border-border bg-bg-secondary">
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
    <pre className="p-2 font-mono text-[12px] leading-5" aria-label="Diff unificado">
      {rows.map((row, i) => (
        <div key={i} className={`flex ${rowClass(row.kind)}`}>
          <span className="w-10 shrink-0 select-none px-1 text-right text-text-muted/50">
            {row.oldLine ?? ""}
          </span>
          <span className="w-10 shrink-0 select-none px-1 text-right text-text-muted/50">
            {row.newLine ?? ""}
          </span>
          <span className="w-4 shrink-0 select-none text-center">
            {row.kind === "add" ? "+" : row.kind === "del" ? "−" : " "}
          </span>
          <span className="min-w-0 flex-1 whitespace-pre-wrap break-all">
            {row.text || " "}
          </span>
        </div>
      ))}
    </pre>
  );
}

function SplitView({ rows }: { rows: ReturnType<typeof toSplitRows> }) {
  return (
    <div className="grid grid-cols-2 font-mono text-[12px] leading-5" aria-label="Diff lado a lado">
      <div className="border-r border-border">
        <div className="sticky top-0 z-10 border-b border-border bg-bg-secondary/95 px-3 py-1 text-[10px] uppercase tracking-wide text-text-muted">
          Antes
        </div>
        {rows.map((row, i) => (
          <SplitCell key={`l-${i}`} cell={row.left} />
        ))}
      </div>
      <div>
        <div className="sticky top-0 z-10 border-b border-border bg-bg-secondary/95 px-3 py-1 text-[10px] uppercase tracking-wide text-text-muted">
          Depois
        </div>
        {rows.map((row, i) => (
          <SplitCell key={`r-${i}`} cell={row.right} />
        ))}
      </div>
    </div>
  );
}

function SplitCell({
  cell,
}: {
  cell: { text: string; kind: DiffRowKind; line?: number } | null;
}) {
  if (!cell) {
    return <div className="min-h-[20px] bg-surface/30 px-2">&nbsp;</div>;
  }
  return (
    <div className={`flex min-h-[20px] ${rowClass(cell.kind)}`}>
      <span className="w-10 shrink-0 select-none px-1 text-right text-text-muted/50">
        {cell.line ?? ""}
      </span>
      <span className="min-w-0 flex-1 whitespace-pre-wrap break-all px-1">
        {cell.text || " "}
      </span>
    </div>
  );
}

function rowClass(kind: DiffRowKind): string {
  switch (kind) {
    case "add":
      return "bg-success/10 text-success";
    case "del":
      return "bg-danger/10 text-danger";
    case "hunk":
      return "bg-accent/5 text-accent";
    case "meta":
      return "text-text-muted/70";
    default:
      return "text-text-muted";
  }
}
