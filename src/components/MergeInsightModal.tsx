import { useAppStore } from "../stores/appStore";
import { IconBranch, IconCommit, IconMerge } from "./Icons";
import logo from "../assets/brand/logo.png";

function statusLabel(status: string): string {
  const code = status.charAt(0).toUpperCase();
  switch (code) {
    case "A":
      return "Added";
    case "M":
      return "Modified";
    case "D":
      return "Deleted";
    case "R":
      return "Renamed";
    case "C":
      return "Copied";
    default:
      return status || "?";
  }
}

function statusClass(status: string): string {
  const code = status.charAt(0).toUpperCase();
  switch (code) {
    case "A":
      return "text-[#3fb950]";
    case "M":
      return "text-[#d29922]";
    case "D":
      return "text-[#f85149]";
    case "R":
    case "C":
      return "text-[#3d8bfd]";
    default:
      return "text-[#8b909a]";
  }
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Pre-merge insight: direction, commits entering, files touched.
 */
export function MergeInsightModal() {
  const prompt = useAppStore((s) => s.mergePrompt);
  const busy = useAppStore((s) => s.busy);
  const confirmMerge = useAppStore((s) => s.confirmMerge);
  const cancelMergePrompt = useAppStore((s) => s.cancelMergePrompt);

  if (!prompt) return null;

  const preview = prompt.preview;
  const canConfirm =
    !busy &&
    !prompt.loading &&
    !prompt.loadError &&
    preview != null &&
    !preview.alreadyUpToDate;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="merge-insight-title"
    >
      <div className="flex max-h-[min(88vh,720px)] w-full max-w-[560px] flex-col rounded-xl border border-[#3a3f4b] bg-[#252830] shadow-2xl shadow-black/60">
        {/* Header */}
        <div className="flex shrink-0 items-start gap-3 px-5 pb-1 pt-4">
          <img src={logo} alt="" className="mt-0.5 h-11 w-11 shrink-0 object-contain" />
          <div className="min-w-0 flex-1 pt-0.5">
            <h2
              id="merge-insight-title"
              className="text-[16px] font-semibold leading-tight text-[#f0f1f4]"
            >
              Merge Insight
            </h2>
            <p className="mt-0.5 text-[12px] text-[#8b909a]">
              Review what will land before you merge
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={cancelMergePrompt}
            className="rounded p-1 text-[16px] leading-none text-[#6b7280] hover:bg-[#2f3440] hover:text-[#e8eaed]"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Direction */}
        <div className="shrink-0 space-y-3 px-5 pt-3">
          <div className="flex items-center gap-2 rounded-lg border border-[#3a3f4b] bg-[#1e222a] px-3 py-2.5">
            <span className="inline-flex min-w-0 flex-1 items-center gap-1.5 text-[13px] text-[#e8eaed]">
              <IconBranch className="h-3.5 w-3.5 shrink-0 text-[#8b909a]" />
              <span className="truncate font-medium">{prompt.source}</span>
            </span>
            <IconMerge className="h-4 w-4 shrink-0 text-[#238636]" />
            <span className="inline-flex min-w-0 flex-1 items-center justify-end gap-1.5 text-[13px] text-[#e8eaed]">
              <IconBranch className="h-3.5 w-3.5 shrink-0 text-[#8b909a]" />
              <span className="truncate font-medium">{prompt.target}</span>
            </span>
          </div>

          {prompt.checkoutRequired && (
            <p className="text-[11px] text-[#d29922]">
              Will checkout <span className="font-medium">{prompt.target}</span> first, then merge{" "}
              <span className="font-medium">{prompt.source}</span>.
            </p>
          )}
          {prompt.changeCount > 0 && (
            <p className="text-[11px] text-[#8b909a]">
              {prompt.changeCount} local change(s) in the working tree
            </p>
          )}
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {prompt.loading && (
            <p className="py-8 text-center text-[13px] text-[#8b909a]">Loading merge preview…</p>
          )}

          {prompt.loadError && (
            <p className="rounded-md border border-[#f85149]/40 bg-[#f85149]/10 px-3 py-2 text-[12px] text-[#f85149]">
              {prompt.loadError}
            </p>
          )}

          {preview && !prompt.loading && (
            <div className="space-y-4">
              {/* Summary strip */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[#8b909a]">
                <span>
                  <span className="font-medium text-[#e8eaed]">{preview.commitCount}</span> commit
                  {preview.commitCount === 1 ? "" : "s"}
                </span>
                <span>
                  <span className="font-medium text-[#e8eaed]">{preview.fileCount}</span> file
                  {preview.fileCount === 1 ? "" : "s"}
                </span>
                {(preview.insertions > 0 || preview.deletions > 0) && (
                  <span>
                    <span className="text-[#3fb950]">+{preview.insertions}</span>
                    {" / "}
                    <span className="text-[#f85149]">−{preview.deletions}</span>
                  </span>
                )}
                {preview.mergeBaseShort && (
                  <span className="font-mono">base {preview.mergeBaseShort}</span>
                )}
                {preview.canFastForward && !preview.alreadyUpToDate && (
                  <span className="text-[#238636]">fast-forward possible</span>
                )}
              </div>

              {preview.alreadyUpToDate ? (
                <p className="rounded-md border border-[#3a3f4b] bg-[#1e222a] px-3 py-3 text-[13px] text-[#8b909a]">
                  Already up to date — nothing to merge into{" "}
                  <span className="text-[#e8eaed]">{preview.target}</span>.
                </p>
              ) : (
                <>
                  {/* Commits */}
                  <section>
                    <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">
                      Commits entering {preview.target}
                    </h3>
                    <ul className="max-h-[180px] space-y-0.5 overflow-y-auto rounded-md border border-[#3a3f4b] bg-[#1e222a]">
                      {preview.commits.map((c) => (
                        <li
                          key={c.hash}
                          className="flex items-start gap-2 border-b border-[#2f3440] px-2.5 py-1.5 last:border-b-0"
                        >
                          <IconCommit className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8b909a]" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[12px] text-[#e8eaed]">{c.subject}</div>
                            <div className="mt-0.5 flex flex-wrap gap-x-2 text-[10px] text-[#6b7280]">
                              <span className="font-mono text-[#8b909a]">{c.shortHash}</span>
                              <span>{c.authorName}</span>
                              <span>{formatWhen(c.authoredAt)}</span>
                            </div>
                          </div>
                        </li>
                      ))}
                      {preview.hasMoreCommits && (
                        <li className="px-2.5 py-1.5 text-[11px] text-[#6b7280]">
                          …and {preview.commitCount - preview.commits.length} more
                        </li>
                      )}
                    </ul>
                  </section>

                  {/* Files */}
                  <section>
                    <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">
                      Files changed
                    </h3>
                    <ul className="max-h-[160px] space-y-0.5 overflow-y-auto rounded-md border border-[#3a3f4b] bg-[#1e222a]">
                      {preview.files.length === 0 ? (
                        <li className="px-2.5 py-2 text-[12px] text-[#6b7280]">No file changes</li>
                      ) : (
                        preview.files.map((f) => (
                          <li
                            key={`${f.status}:${f.path}`}
                            className="flex items-center gap-2 border-b border-[#2f3440] px-2.5 py-1 last:border-b-0"
                          >
                            <span
                              className={`w-14 shrink-0 text-[10px] font-medium uppercase ${statusClass(f.status)}`}
                            >
                              {statusLabel(f.status)}
                            </span>
                            <span className="min-w-0 truncate font-mono text-[11px] text-[#d0d4dc]">
                              {f.path}
                            </span>
                          </li>
                        ))
                      )}
                    </ul>
                  </section>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 justify-end gap-2 border-t border-[#3a3f4b] px-5 py-3">
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => void confirmMerge()}
            className="h-8 min-w-[88px] rounded-md bg-[#238636] px-4 text-[12px] font-medium text-white hover:bg-[#2ea043] disabled:opacity-40"
          >
            Merge
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={cancelMergePrompt}
            className="h-8 min-w-[88px] rounded-md border border-[#3a3f4b] bg-[#2a2e38] px-4 text-[12px] text-[#d0d4dc] hover:bg-[#323640] disabled:opacity-40"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
