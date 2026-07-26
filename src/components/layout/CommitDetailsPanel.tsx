import { useAppStore } from "../../stores/appStore";

export function CommitDetailsPanel() {
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
      <aside className="flex w-[300px] shrink-0 flex-col border-l border-[#2d3139] bg-[#1c1f26] p-3 text-[11px] text-[#6b7280]">
        Selecione um commit ou o WIP.
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
    <aside className="flex w-[300px] shrink-0 flex-col border-l border-[#2d3139] bg-[#1c1f26]">
      <div className="flex items-center justify-between border-b border-[#2d3139] px-2.5 py-1.5">
        <div className="font-mono text-[10px] text-[#6b7280]">
          commit: {selected.shortHash}
        </div>
        <button
          type="button"
          className="text-[10px] text-[#3d8bfd] hover:underline"
          onClick={() => void selectCommit(null)}
        >
          ← WIP
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-2.5 overflow-auto p-2.5">
        <div className="rounded border border-[#2d3139] bg-[#171a20] px-2 py-2 text-[12px] leading-snug text-[#e8eaed]">
          {selected.subject}
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-gradient-to-br from-[#7c6cff] to-[#c44ec0] text-[11px] font-bold text-white">
            {letter}
          </span>
          <div className="min-w-0">
            <div className="truncate text-[12px] font-medium text-[#e8eaed]">
              {selected.authorName}
            </div>
            <div className="text-[10px] text-[#5c6370]">
              {new Date(selected.authoredAt).toLocaleString("pt-BR")}
            </div>
            {parent && (
              <div className="font-mono text-[10px] text-[#5c6370]">parent: {parent}</div>
            )}
          </div>
        </div>

        {selected.refs.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {selected.refs.map((r) => (
              <span
                key={r}
                className="rounded bg-[#238636]/20 px-1 py-px text-[9px] text-[#3dd68c]"
              >
                {r.replace(/^refs\/(heads|remotes|tags)\//, "")}
              </span>
            ))}
          </div>
        )}

        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-wide text-[#6b7280]">
              Files changed
            </span>
            <span className="text-[10px] text-[#6b7280]">
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
                <li key={f.path}>
                  <button
                    type="button"
                    title={f.path}
                    onClick={() => void selectCommitFile(f.path)}
                    className={`flex w-full items-center gap-1.5 px-1.5 py-1 text-left font-mono text-[10px] ${
                      active
                        ? "bg-[#1e3a5f] text-[#e8eaed]"
                        : "text-[#c8ccd4] hover:bg-[#252830]"
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

      <div className="border-t border-[#2d3139] p-2.5">
        <button
          type="button"
          disabled={busy}
          className="w-full rounded border border-[#2d3139] py-1.5 text-[11px] text-[#c8ccd4] hover:bg-[#252830] disabled:opacity-40"
          onClick={() => {
            if (window.confirm(`Cherry-pick ${selected.shortHash}?`)) {
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
    return <span className="w-3 text-center font-bold text-[#3dd68c]">+</span>;
  }
  if (s.startsWith("d") || s.includes("del")) {
    return <span className="w-3 text-center font-bold text-[#f85149]">−</span>;
  }
  return <span className="w-3 text-center font-bold text-[#e3b341]">/</span>;
}
