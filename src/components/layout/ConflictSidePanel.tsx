import { useMemo } from "react";
import { useAppStore } from "../../stores/appStore";
import { requireDangerousConfirm } from "../../lib/dangerousConfirm";

/**
 * Right commit panel while merge/rebase/cherry-pick has conflicts (GitKraken-style).
 */
export function ConflictSidePanel() {
  const {
    status,
    conflictPath,
    loadConflictFile,
    markAllConflictsResolved,
    continueIntegrate,
    abortIntegrate,
    resolvedConflictPaths,
    busy,
  } = useAppStore();

  const inProgress = status?.inProgress ?? null;
  const conflicts = useMemo(() => status?.conflicts ?? [], [status?.conflicts]);
  const resolved = useMemo(
    () => resolvedConflictPaths.filter((p) => !conflicts.includes(p)),
    [resolvedConflictPaths, conflicts],
  );

  const canContinue = conflicts.length === 0 && Boolean(inProgress);
  const opLabel = label(inProgress);

  return (
    <aside className="flex w-[300px] shrink-0 flex-col border-l border-[#2d3139] bg-[#1c1f26]">
      <div className="border-b border-[#2d3139] px-2.5 py-2.5">
        <div className="text-[12px] font-semibold text-[#e8c547]">
          ⚠ {opLabel} conflicts detected
        </div>
        <div className="mt-1 text-[11px] leading-snug text-[#8b909a]">
          {inProgress === "merge" ? (
            <>
              Merging into{" "}
              <span className="rounded bg-[#238636]/25 px-1.5 py-0.5 text-[#3fb950]">
                {status?.branch ?? "HEAD"}
              </span>
            </>
          ) : (
            <>
              {opLabel} on{" "}
              <span className="rounded bg-[#388bfd]/20 px-1.5 py-0.5 text-[#58a6ff]">
                {status?.branch ?? "HEAD"}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <section className="border-b border-[#2d3139]">
          <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wide text-[#8b909a]">
              Conflicted Files ({conflicts.length})
            </span>
            {conflicts.length > 0 && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void markAllConflictsResolved()}
                className="text-[10px] text-[#58a6ff] hover:underline disabled:opacity-40"
              >
                Mark All Resolved
              </button>
            )}
          </div>
          {conflicts.length === 0 ? (
            <p className="px-2.5 pb-2 text-[11px] text-[#6b7280]">Nenhum conflito restante.</p>
          ) : (
            <ul className="pb-1">
              {conflicts.map((path) => (
                <li key={path}>
                  <button
                    type="button"
                    title={path}
                    onClick={() => void loadConflictFile(path)}
                    className={`flex w-full items-center gap-1.5 truncate px-2.5 py-1 text-left text-[11px] ${
                      conflictPath === path
                        ? "bg-[#388bfd]/20 text-[#e8eaed]"
                        : "text-[#c9d1d9] hover:bg-[#252830]"
                    }`}
                  >
                    <span className="shrink-0 text-[#e3b341]" aria-hidden>
                      ⚠
                    </span>
                    <span className="truncate">{path}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {resolved.length > 0 && (
          <section>
            <div className="px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-wide text-[#8b909a]">
              Resolved Files ({resolved.length})
            </div>
            <ul className="pb-1">
              {resolved.map((path) => (
                <li
                  key={path}
                  className="flex items-center gap-1.5 truncate px-2.5 py-1 text-[11px] text-[#6b7280]"
                  title={path}
                >
                  <span className="shrink-0 text-[#3fb950]" aria-hidden>
                    ✓
                  </span>
                  <span className="truncate">{path}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <div className="space-y-1.5 border-t border-[#2d3139] bg-[#171a20] p-2.5">
        <button
          type="button"
          disabled={busy || !canContinue}
          onClick={() => void continueIntegrate()}
          className="w-full rounded bg-[#238636] py-2 text-[12px] font-medium text-white hover:bg-[#2ea043] disabled:cursor-not-allowed disabled:opacity-35"
        >
          {inProgress === "merge"
            ? "Commit and Merge"
            : inProgress === "rebase"
              ? "Continue Rebase"
              : "Continue"}
        </button>
        <button
          type="button"
          disabled={busy || !inProgress}
          onClick={() => {
            if (requireDangerousConfirm(`Abortar ${opLabel.toLowerCase()}?`)) {
              void abortIntegrate();
            }
          }}
          className="w-full rounded border border-[#f85149]/50 py-2 text-[12px] font-medium text-[#f85149] hover:bg-[#f85149]/10 disabled:opacity-35"
        >
          Abort {opLabel}
        </button>
      </div>
    </aside>
  );
}

function label(kind: string | null): string {
  switch (kind) {
    case "merge":
      return "Merge";
    case "rebase":
      return "Rebase";
    case "cherry-pick":
      return "Cherry-pick";
    default:
      return "Integrate";
  }
}
