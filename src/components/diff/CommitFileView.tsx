import { useMemo, useState, type ReactNode } from "react";
import { useAppStore } from "../../stores/appStore";
import { usePrefsStore } from "../../stores/prefsStore";
import { parseUnifiedDiff, toSplitRows, type DiffRowKind } from "../../lib/diffParse";
import { IconClose, IconSearch } from "../Icons";
import { CodeEditorView, CodeLine } from "./CodeEditorView";

/**
 * GitKraken-like commit file viewer:
 * path breadcrumb · Edit in WD · File/Diff toggle · prev/next · unified/split diff
 */
export function CommitFileView() {
  const {
    graph,
    filteredCommits,
    selectedCommitHash,
    selectedCommitFile,
    commitFiles,
    commitFileContent,
    commitFileViewMode,
    setCommitFileViewMode,
    diffText,
    selectCommitFile,
    navigateCommitFile,
    openCommitFileInWorkingDir,
    busy,
  } = useAppStore();

  const [layout, setLayout] = useState<"unified" | "split">(usePrefsStore.getState().diffLayout);
  const commits = filteredCommits ?? graph?.commits ?? [];
  const selected = commits.find((c) => c.hash === selectedCommitHash);
  const fileIdx = commitFiles.findIndex((f) => f.path === selectedCommitFile);
  const pathParts = (selectedCommitFile ?? "").split(/[/\\]/).filter(Boolean);

  const rows = useMemo(() => parseUnifiedDiff(diffText), [diffText]);
  const split = useMemo(() => toSplitRows(rows), [rows]);

  if (!selectedCommitFile || !selected) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#171a20]">
      <div className="flex items-center gap-2 border-b border-[#2d3139] bg-[#1c1f26] px-3 py-1.5">
        <div className="min-w-0 flex-1 truncate font-mono text-[11px] text-[#c8ccd4]">
          {pathParts.map((part, i) => (
            <span key={`${part}-${i}`}>
              {i > 0 && <span className="text-[#5c6370]"> / </span>}
              <span className={i === pathParts.length - 1 ? "text-[#e8eaed]" : "text-[#8b909a]"}>
                {part}
              </span>
            </span>
          ))}
        </div>
        <span className="shrink-0 text-[10px] text-[#5c6370]">UTF-8</span>
        <button
          type="button"
          title="Fechar arquivo"
          className="rounded p-1 text-[#6b7280] hover:bg-[#252830] hover:text-[#e8eaed]"
          onClick={() => void selectCommitFile(null)}
        >
          <IconClose className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-[#2d3139] px-3 py-1.5">
        <button
          type="button"
          disabled={busy}
          className="rounded border border-[#3d8bfd]/40 bg-[#1e3a5f]/40 px-2.5 py-1 text-[11px] text-[#8bb4f0] hover:bg-[#1e3a5f] disabled:opacity-40"
          onClick={() => void openCommitFileInWorkingDir()}
        >
          Edit in Working Directory
        </button>

        <div
          className="inline-flex rounded border border-[#2d3139] p-0.5"
          role="group"
          aria-label="Modo de visualização"
        >
          <ToggleBtn
            active={commitFileViewMode === "file"}
            onClick={() => setCommitFileViewMode("file")}
          >
            File View
          </ToggleBtn>
          <ToggleBtn
            active={commitFileViewMode === "diff"}
            onClick={() => setCommitFileViewMode("diff")}
          >
            Diff View
          </ToggleBtn>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <GhostBtn title="Blame (em breve)" disabled>
            Blame
          </GhostBtn>
          <GhostBtn title="History (em breve)" disabled>
            History
          </GhostBtn>
          <GhostBtn
            title="Arquivo anterior"
            disabled={fileIdx <= 0}
            onClick={() => void navigateCommitFile(-1)}
          >
            ↑
          </GhostBtn>
          <GhostBtn
            title="Próximo arquivo"
            disabled={fileIdx < 0 || fileIdx >= commitFiles.length - 1}
            onClick={() => void navigateCommitFile(1)}
          >
            ↓
          </GhostBtn>
          <span className="px-1 font-mono text-[10px] text-[#5c6370]">
            {fileIdx >= 0 ? fileIdx + 1 : 0}/{commitFiles.length}
          </span>
          {commitFileViewMode === "diff" && (
            <div className="ml-1 inline-flex rounded border border-[#2d3139] p-0.5">
              <ToggleBtn active={layout === "unified"} onClick={() => setLayout("unified")}>
                Inline
              </ToggleBtn>
              <ToggleBtn active={layout === "split"} onClick={() => setLayout("split")}>
                Split
              </ToggleBtn>
            </div>
          )}
          <span className="rounded p-1 text-[#5c6370]" title="Busca no arquivo (em breve)">
            <IconSearch className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {busy ? (
          <div className="p-6 text-[12px] text-[#6b7280]">Carregando…</div>
        ) : commitFileViewMode === "file" ? (
          <CodeEditorView
            text={commitFileContent}
            label={`Conteúdo de ${selectedCommitFile}`}
            emptyMessage="Conteúdo indisponível neste commit (arquivo removido ou binário)."
          />
        ) : diffText.trim() === "" ? (
          <div className="p-6 text-[12px] text-[#6b7280]">
            Sem diff textual (binário, rename sem delta, ou sem mudanças visíveis).
          </div>
        ) : layout === "unified" ? (
          <div className="min-h-0 flex-1 overflow-auto bg-[#0d1117]">
            <UnifiedView rows={rows} />
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto bg-[#0d1117]">
            <SplitView rows={split} />
          </div>
        )}
      </div>
    </div>
  );
}

function ToggleBtn({
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
      className={`rounded px-2 py-0.5 text-[10px] transition ${
        active ? "bg-[#2a2e38] text-[#e8eaed]" : "text-[#6b7280] hover:text-[#c8ccd4]"
      }`}
    >
      {children}
    </button>
  );
}

function GhostBtn({
  children,
  title,
  disabled,
  onClick,
}: {
  children: ReactNode;
  title?: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="rounded px-1.5 py-0.5 text-[10px] text-[#8b909a] hover:bg-[#252830] hover:text-[#e8eaed] disabled:cursor-not-allowed disabled:opacity-35"
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
            <span className="min-w-0 flex-1 whitespace-pre-wrap break-all">{row.text || " "}</span>
          ) : (
            <CodeLine text={row.text} lineKey={`u-${i}`} />
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
          <SplitCell key={`l-${i}`} cell={row.left} lineKey={`sl-${i}`} />
        ))}
      </div>
      <div>
        <div className="sticky top-0 z-10 border-b border-[#2d3139] bg-[#161b22] px-3 py-1 text-[10px] uppercase tracking-wide text-[#8b909a]">
          Depois
        </div>
        {rows.map((row, i) => (
          <SplitCell key={`r-${i}`} cell={row.right} lineKey={`sr-${i}`} />
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
