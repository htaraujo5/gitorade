import { useEffect, useMemo } from "react";
import { useAppStore } from "../stores/appStore";

export function ConflictBanner() {
  const {
    status,
    conflictPath,
    conflictDraft,
    setConflictDraft,
    loadConflictFile,
    resolveConflict,
    abortIntegrate,
    continueIntegrate,
    busy,
  } = useAppStore();

  const inProgress = status?.inProgress ?? null;
  const conflicts = useMemo(() => status?.conflicts ?? [], [status?.conflicts]);

  useEffect(() => {
    if (conflicts.length > 0 && !conflictPath) {
      void loadConflictFile(conflicts[0]);
    }
  }, [conflicts, conflictPath, loadConflictFile]);

  if (!inProgress && conflicts.length === 0) return null;

  const canContinue = conflicts.length === 0 && Boolean(inProgress);

  return (
    <div
      className="rounded-[var(--radius-md)] border border-warning/40 bg-warning/10 p-3"
      role="region"
      aria-label="Resolução de conflitos"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm">
          <span className="font-semibold text-warning">
            {inProgress ? `${label(inProgress)} em andamento` : "Conflitos"}
          </span>
          {conflicts.length > 0 && (
            <span className="ml-2 text-xs text-text-muted">
              {conflicts.length} arquivo(s) em conflito
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !canContinue}
            onClick={() => void continueIntegrate()}
            className="brand-gradient rounded-[var(--radius-sm)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
          >
            Continuar
          </button>
          <button
            type="button"
            disabled={busy || !inProgress}
            onClick={() => {
              if (window.confirm("Abortar a operação atual?")) {
                void abortIntegrate();
              }
            }}
            className="rounded-[var(--radius-sm)] border border-danger/40 px-3 py-1.5 text-xs text-danger hover:bg-danger/10 disabled:opacity-40"
          >
            Abortar
          </button>
        </div>
      </div>

      {conflicts.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-[200px_1fr]">
          <ul className="max-h-40 space-y-1 overflow-auto text-xs">
            {conflicts.map((path) => (
              <li key={path}>
                <button
                  type="button"
                  onClick={() => void loadConflictFile(path)}
                  className={`w-full truncate rounded px-2 py-1 text-left hover:bg-surface ${
                    conflictPath === path ? "bg-surface text-text" : "text-text-muted"
                  }`}
                >
                  {path}
                </button>
              </li>
            ))}
          </ul>

          {conflictPath && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void resolveConflict(conflictPath, "ours")}
                  className="rounded-[var(--radius-sm)] border border-border px-2 py-1 text-[11px] hover:bg-surface disabled:opacity-40"
                >
                  Manter ours
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void resolveConflict(conflictPath, "theirs")}
                  className="rounded-[var(--radius-sm)] border border-border px-2 py-1 text-[11px] hover:bg-surface disabled:opacity-40"
                >
                  Usar theirs
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void resolveConflict(conflictPath, "content", conflictDraft)}
                  className="rounded-[var(--radius-sm)] border border-border px-2 py-1 text-[11px] hover:bg-surface disabled:opacity-40"
                >
                  Salvar edição
                </button>
              </div>
              <textarea
                className="h-48 w-full resize-y rounded-[var(--radius-sm)] border border-border bg-bg p-2 font-mono text-[11px] leading-4 outline-none focus:border-primary"
                value={conflictDraft}
                onChange={(e) => setConflictDraft(e.target.value)}
                aria-label={`Conteúdo conflitante de ${conflictPath}`}
                spellCheck={false}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function label(kind: string): string {
  switch (kind) {
    case "merge":
      return "Merge";
    case "rebase":
      return "Rebase";
    case "cherry-pick":
      return "Cherry-pick";
    default:
      return kind;
  }
}
