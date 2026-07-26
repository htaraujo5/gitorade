import { useEffect, useRef } from "react";
import { useAppStore } from "../stores/appStore";

export function OperationOverlay() {
  const { operation, cancelOperation, dismissOperation } = useAppStore();
  const primaryRef = useRef<HTMLButtonElement>(null);

  const done = operation?.done ?? false;

  useEffect(() => {
    if (!operation) return;
    primaryRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (done) {
        dismissOperation();
      } else {
        void cancelOperation();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [operation, done, cancelOperation, dismissOperation]);

  if (!operation) return null;

  const { label, percent, lines, success } = operation;
  const tail = lines.slice(-8);
  const statusText = done
    ? success
      ? "Concluído"
      : "Finalizado"
    : percent !== null
      ? `${percent}%`
      : "Em progresso";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="operation-title"
    >
      <div className="w-full max-w-lg rounded-[var(--radius-md)] border border-border bg-bg-secondary p-4">
        <div className="mb-3 flex items-center justify-between">
          <div id="operation-title" className="text-sm font-semibold">
            {label}
          </div>
          <div className="text-xs text-text-muted" aria-live="polite">
            {statusText}
          </div>
        </div>

        <div
          className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-surface"
          role="progressbar"
          aria-label={`Progresso: ${label}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent ?? undefined}
        >
          <div
            className={`h-full transition-all ${
              done ? (success ? "bg-success" : "bg-danger") : "brand-gradient"
            }`}
            style={{ width: `${percent ?? (done ? 100 : 8)}%` }}
          />
        </div>

        <pre
          className="mb-3 max-h-40 overflow-auto rounded-[var(--radius-sm)] border border-border bg-bg p-2 font-mono text-[11px] leading-4 text-text-muted"
          aria-live="polite"
          aria-label="Saída da operação"
        >
          {tail.length === 0 ? "Iniciando…" : tail.join("\n")}
        </pre>

        <div className="flex justify-end gap-2">
          {!done ? (
            <button
              ref={primaryRef}
              type="button"
              onClick={() => void cancelOperation()}
              className="rounded-[var(--radius-sm)] border border-border px-3 py-1.5 text-xs text-danger hover:bg-surface"
            >
              Cancelar
            </button>
          ) : (
            <button
              ref={primaryRef}
              type="button"
              onClick={dismissOperation}
              className="rounded-[var(--radius-sm)] border border-border px-3 py-1.5 text-xs hover:bg-surface"
            >
              Fechar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
