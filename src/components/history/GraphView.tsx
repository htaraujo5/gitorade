import { useMemo } from "react";
import { useAppStore } from "../../stores/appStore";
import type { CommitSummary } from "../../lib/api";

const LANE_COLORS = ["#7c6cff", "#e14bb8", "#58a6ff", "#d29922", "#238636", "#da3633"];

function relativeTime(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} d`;
  return new Date(t).toLocaleDateString("pt-BR");
}

function GraphColumn({ commits, maxLane }: { commits: CommitSummary[]; maxLane: number }) {
  const rowH = 40;
  const laneW = 14;
  const width = Math.max((maxLane + 1) * laneW + 8, 28);
  const height = commits.length * rowH;

  return (
    <svg width={width} height={height} className="shrink-0">
      {commits.map((commit, row) => {
        const color = LANE_COLORS[commit.lane % LANE_COLORS.length];
        const cx = 8 + commit.lane * laneW;
        const cy = row * rowH + rowH / 2;
        const parentRows = commit.parents
          .map((p) => commits.findIndex((c) => c.hash === p))
          .filter((i) => i > row);

        return (
          <g key={commit.hash}>
            {parentRows.map((pRow, idx) => {
              const parent = commits[pRow];
              const px = 8 + parent.lane * laneW;
              const py = pRow * rowH + rowH / 2;
              const stroke = LANE_COLORS[(idx === 0 ? commit.lane : parent.lane) % LANE_COLORS.length];
              return (
                <path
                  key={`${commit.hash}-${parent.hash}`}
                  d={`M ${cx} ${cy} C ${cx} ${(cy + py) / 2}, ${px} ${(cy + py) / 2}, ${px} ${py}`}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={2}
                  opacity={0.85}
                />
              );
            })}
            <circle cx={cx} cy={cy} r={4.5} fill={color} stroke="#0a0a0b" strokeWidth={1.5} />
          </g>
        );
      })}
    </svg>
  );
}

export function GraphView() {
  const {
    graph,
    filteredCommits,
    commitQuery,
    setCommitQuery,
    searchCommits,
    refreshHistory,
    busy,
  } = useAppStore();

  const commits = filteredCommits ?? graph?.commits ?? [];
  const maxLane = useMemo(
    () => commits.reduce((m, c) => Math.max(m, c.lane), 0),
    [commits],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center gap-2">
        <input
          className="flex-1 rounded-[var(--radius-sm)] border border-border bg-bg-secondary px-3 py-1.5 text-sm outline-none focus:border-primary"
          placeholder="Buscar commits (mensagem, autor, hash, branch)…"
          value={commitQuery}
          onChange={(e) => setCommitQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void searchCommits();
          }}
        />
        <button
          type="button"
          className="rounded-[var(--radius-sm)] border border-border px-3 py-1.5 text-xs hover:bg-surface"
          onClick={() => void searchCommits()}
        >
          Buscar
        </button>
        <button
          type="button"
          disabled={busy}
          className="rounded-[var(--radius-sm)] border border-border px-3 py-1.5 text-xs hover:bg-surface disabled:opacity-40"
          onClick={() => {
            setCommitQuery("");
            void refreshHistory();
          }}
        >
          Limpar
        </button>
      </div>

      {commits.length === 0 ? (
        <div className="rounded-[var(--radius-md)] border border-dashed border-border p-6 text-sm text-text-muted">
          Nenhum commit encontrado.
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto rounded-[var(--radius-md)] border border-border bg-bg-secondary">
          <div className="flex">
            <GraphColumn commits={commits} maxLane={maxLane} />
            <ul className="min-w-0 flex-1">
              {commits.map((commit) => (
                <li
                  key={commit.hash}
                  className="flex h-10 items-center gap-3 border-b border-border/60 px-3 text-sm"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    {commit.refs.slice(0, 2).map((refName) => (
                      <span
                        key={refName}
                        className="shrink-0 rounded-full bg-branch-current/15 px-2 py-0.5 text-[10px] text-branch-current"
                      >
                        {refName.replace(/^refs\/(heads|remotes)\//, "")}
                      </span>
                    ))}
                    <span className="truncate font-medium">{commit.subject}</span>
                  </div>
                  <span className="hidden w-32 shrink-0 truncate text-xs text-text-muted md:block">
                    {commit.authorName}
                  </span>
                  <span className="w-16 shrink-0 font-mono text-[11px] text-text-muted">
                    {commit.shortHash}
                  </span>
                  <span className="w-14 shrink-0 text-right text-[11px] text-text-muted">
                    {relativeTime(commit.authoredAt)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
