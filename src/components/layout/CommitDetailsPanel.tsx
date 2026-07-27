import { useAppStore } from "../../stores/appStore";
import { requireDangerousConfirm } from "../../lib/dangerousConfirm";
import { dateLocale, useLocale, useT } from "../../i18n";

export function CommitDetailsPanel() {
  const t = useT();
  const locale = useLocale();
  const {
    graph,
    filteredCommits,
    selectedCommitHash,
    selectedCommitFile,
    commitFiles,
    selectCommit,
    selectCommitFile,
    cherryPick,
    busy,
  } = useAppStore();

  const commits = filteredCommits ?? graph?.commits ?? [];
  const selected = commits.find((c) => c.hash === selectedCommitHash);

  if (!selected) {
    return (
      <aside className="flex w-[280px] shrink-0 flex-col border-l border-[#2d3139] bg-[#1c1f26] p-2.5 text-[10px] text-[#6b7280]">
        {t("details.select")}
      </aside>
    );
  }

  const letter = selected.authorName.trim().slice(0, 1).toUpperCase() || "?";
  const parent = selected.parents[0]?.slice(0, 7);

  const modified = commitFiles.filter((f) => {
    const s = f.status.toLowerCase();
    return !s.startsWith("a") && !s.startsWith("d") && !s.includes("add") && !s.includes("del");
  }).length;
  const added = commitFiles.filter((f) => {
    const s = f.status.toLowerCase();
    return s.startsWith("a") || s.includes("add") || s.includes("new");
  }).length;
  const deleted = commitFiles.filter((f) => {
    const s = f.status.toLowerCase();
    return s.startsWith("d") || s.includes("del");
  }).length;

  return (
    <aside className="flex w-[280px] shrink-0 flex-col border-l border-[#2d3139] bg-[#1c1f26]">
      <div className="flex items-center justify-between border-b border-[#2d3139] px-2 py-1">
        <div className="font-mono text-[9px] text-[#6b7280]">commit: {selected.shortHash}</div>
        <button
          type="button"
          className="text-[9px] text-[#3d8bfd] hover:underline"
          onClick={() => void selectCommit(null)}
        >
          {t("details.backWip")}
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-auto p-2">
        <div className="rounded border border-[#2d3139] bg-[#171a20] px-1.5 py-1.5 text-[11px] leading-snug text-[#e8eaed]">
          {selected.subject}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-gradient-to-br from-[#7c6cff] to-[#c44ec0] text-[9px] font-bold text-white">
            {letter}
          </span>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[11px] font-medium text-[#e8eaed]">
              {selected.authorName}
            </div>
            {selected.authorEmail && (
              <div className="truncate text-[9px] text-[#8b909a]" title={selected.authorEmail}>
                {selected.authorEmail}
              </div>
            )}
            <div className="text-[9px] text-[#5c6370]">
              {new Date(selected.authoredAt).toLocaleString(dateLocale(locale))}
            </div>
            {parent && <div className="font-mono text-[9px] text-[#5c6370]">parent: {parent}</div>}
          </div>
        </div>

        {selected.refs.length > 0 && (
          <div className="flex flex-wrap gap-0.5">
            {selected.refs.map((r) => (
              <span
                key={r}
                className="rounded bg-[#238636]/20 px-1 py-px text-[8px] leading-tight text-[#3dd68c]"
              >
                {r.replace(/^refs\/(heads|remotes|tags)\//, "")}
              </span>
            ))}
          </div>
        )}

        <div>
          <div className="mb-0.5 flex items-center justify-between gap-1">
            <span className="text-[8px] font-bold uppercase tracking-wide text-[#6b7280]">
              Files changed
            </span>
            <span className="text-[9px] text-[#6b7280]">
              {modified > 0 && <span className="text-[#e3b341]">{modified} mod </span>}
              {added > 0 && <span className="text-[#3dd68c]">{added} add </span>}
              {deleted > 0 && <span className="text-[#f85149]">{deleted} del</span>}
              {commitFiles.length === 0 && "0"}
            </span>
          </div>
          <ul className="max-h-[50vh] overflow-auto rounded border border-[#2d3139]">
            {commitFiles.map((f) => {
              const active = f.path === selectedCommitFile;
              const name = f.path.split(/[/\\]/).pop() ?? f.path;
              const dir = f.path.slice(0, Math.max(0, f.path.length - name.length - 1));
              return (
                <li key={f.path} className="border-b border-[#2d3139]/40 last:border-0">
                  <button
                    type="button"
                    title={f.path}
                    onClick={() => void selectCommitFile(f.path)}
                    className={`flex w-full items-center gap-1 px-1.5 py-0.5 text-left font-mono text-[10px] leading-tight ${
                      active ? "bg-[#1e3a5f] text-[#e8eaed]" : "text-[#c8ccd4] hover:bg-[#252830]"
                    }`}
                  >
                    <StatusLetter status={f.status} />
                    <span className="min-w-0 flex-1 truncate">
                      {dir ? (
                        <>
                          <span className="text-[#5c6370]">{dir}/</span>
                          {name}
                        </>
                      ) : (
                        name
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="border-t border-[#2d3139] p-2">
        <button
          type="button"
          disabled={busy}
          className="w-full rounded border border-[#2d3139] py-1 text-[10px] text-[#c8ccd4] hover:bg-[#252830] disabled:opacity-40"
          onClick={() => {
            if (requireDangerousConfirm(`Cherry-pick ${selected.shortHash}?`)) {
              void cherryPick(selected.hash);
            }
          }}
        >
          Cherry-pick
        </button>
      </div>
    </aside>
  );
}

function StatusLetter({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s.startsWith("a") || s.includes("add") || s.includes("new")) {
    return (
      <span className="w-2.5 shrink-0 text-center text-[10px] font-bold text-[#3dd68c]">+</span>
    );
  }
  if (s.startsWith("d") || s.includes("del")) {
    return (
      <span className="w-2.5 shrink-0 text-center text-[10px] font-bold text-[#f85149]">âˆ’</span>
    );
  }
  return <span className="w-2.5 shrink-0 text-center text-[10px] font-bold text-[#e3b341]">/</span>;
}
