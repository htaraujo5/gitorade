import { useMemo, useRef, useEffect, useState } from "react";
import { useAppStore } from "../../stores/appStore";
import { usePrefsStore } from "../../stores/prefsStore";
import type { CommitSummary } from "../../lib/api";
import { IconClose, IconSearch } from "../Icons";

const LANE_COLORS = ["#3dd68c", "#3d8bfd", "#e3b341", "#a371f7", "#f778ba", "#f85149", "#56d4dd"];
const ROW_H = 34;
const LANE_W = 26;
const NODE_R = 9;

function relativeTime(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(t).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function shortRef(refName: string): string {
  return refName.replace(/^refs\/(heads|remotes|tags)\//, "");
}

/** Deterministic color from email/name (identicon-style). */
function authorHue(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue} 48% 42%)`;
}

function authorInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function AuthorAvatar({
  name,
  email,
  size = 18,
}: {
  name: string;
  email: string;
  size?: number;
}) {
  const bg = authorHue(email || name);
  const initials = authorInitials(name || email || "?");
  return (
    <span
      title={`${name} <${email}>`}
      className="inline-flex shrink-0 items-center justify-center rounded-full font-medium text-white"
      style={{
        width: size,
        height: size,
        background: bg,
        fontSize: Math.max(8, Math.floor(size * 0.42)),
      }}
    >
      {initials}
    </span>
  );
}

function GraphColumn({
  commits,
  maxLane,
  showAvatars,
}: {
  commits: CommitSummary[];
  maxLane: number;
  showAvatars: boolean;
}) {
  const width = Math.max((maxLane + 1) * LANE_W + 12, 36);
  const height = commits.length * ROW_H;
  const hashIndex = useMemo(() => {
    const m = new Map<string, number>();
    commits.forEach((c, i) => m.set(c.hash, i));
    return m;
  }, [commits]);

  return (
    <div className="relative shrink-0" style={{ width, height }}>
      <svg width={width} height={height} className="absolute inset-0 block">
        {commits.map((commit, row) => {
          const cx = 12 + commit.lane * LANE_W;
          const cy = row * ROW_H + ROW_H / 2;
          const parentRows = commit.parents
            .map((p) => hashIndex.get(p))
            .filter((i): i is number => i !== undefined && i > row);

          return (
            <g key={`edge-${commit.hash}`}>
              {parentRows.map((pRow, idx) => {
                const parent = commits[pRow];
                const px = 12 + parent.lane * LANE_W;
                const py = pRow * ROW_H + ROW_H / 2;
                const stroke =
                  LANE_COLORS[
                    (idx === 0 ? commit.lane : parent.lane) % LANE_COLORS.length
                  ];
                const midY = (cy + py) / 2;
                return (
                  <path
                    key={`${commit.hash}-${parent.hash}`}
                    d={`M ${cx} ${cy + NODE_R} C ${cx} ${midY}, ${px} ${midY}, ${px} ${py - NODE_R}`}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={2.75}
                    strokeLinecap="round"
                  />
                );
              })}
            </g>
          );
        })}
      </svg>

      {commits.map((commit, row) => {
        const color = LANE_COLORS[commit.lane % LANE_COLORS.length];
        const cx = 12 + commit.lane * LANE_W;
        const size = NODE_R * 2;
        const top = row * ROW_H + ROW_H / 2 - NODE_R;
        return (
          <div
            key={`node-${commit.hash}`}
            className="pointer-events-none absolute flex items-center justify-center rounded-full"
            style={{
              left: cx - NODE_R,
              top,
              width: size,
              height: size,
              background: color,
              padding: showAvatars ? 2 : 0,
            }}
          >
            {showAvatars ? (
              <AuthorAvatar
                name={commit.authorName}
                email={commit.authorEmail}
                size={size - 4}
              />
            ) : (
              <span
                className="h-full w-full rounded-full"
                style={{ background: "#171a20", boxShadow: `inset 0 0 0 2px ${color}` }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Stat({
  kind,
  n,
}: {
  kind: "add" | "mod" | "del";
  n: number;
}) {
  if (n <= 0) return null;
  const color =
    kind === "add" ? "text-[#3dd68c]" : kind === "del" ? "text-[#f85149]" : "text-[#e3b341]";
  const mark = kind === "add" ? "+" : kind === "del" ? "−" : "/";
  return (
    <span className={`inline-flex items-center gap-0.5 font-mono text-[11px] ${color}`}>
      <span className="text-[10px] font-medium">{mark}</span>
      <span>{n.toLocaleString()}</span>
    </span>
  );
}

/** GitKraken-like graph: avatar nodes, author column, search via toolbar icon. */
export function GraphView() {
  const {
    graph,
    filteredCommits,
    commitQuery,
    setCommitQuery,
    commitSearchOpen,
    searchCommits,
    clearCommitSearch,
    selectCommit,
    selectedCommitHash,
    status,
    busy,
  } = useAppStore();

  const showAvatars = usePrefsStore((s) => s.showAvatars);
  const relativeDates = usePrefsStore((s) => s.relativeDates);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [resultIndex, setResultIndex] = useState(0);

  const commits = useMemo(
    () => filteredCommits ?? graph?.commits ?? [],
    [filteredCommits, graph],
  );
  const maxLane = useMemo(
    () => commits.reduce((m, c) => Math.max(m, c.lane), 0),
    [commits],
  );
  const graphW = Math.max((maxLane + 1) * LANE_W + 12, 36);
  const changeCount =
    (status?.staged.length ?? 0) + (status?.unstaged.length ?? 0);
  const added =
    (status?.staged.filter((f) => f.status === "added" || f.status === "untracked")
      .length ?? 0) +
    (status?.unstaged.filter((f) => f.status === "added" || f.status === "untracked")
      .length ?? 0);
  const deleted =
    (status?.staged.filter((f) => f.status === "deleted").length ?? 0) +
    (status?.unstaged.filter((f) => f.status === "deleted").length ?? 0);
  const modified = Math.max(0, changeCount - added - deleted);
  const wipActive = selectedCommitHash === null;
  const resultCount = filteredCommits?.length ?? 0;
  const searching = Boolean(filteredCommits);

  useEffect(() => {
    if (commitSearchOpen) {
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [commitSearchOpen]);

  useEffect(() => {
    setResultIndex(0);
  }, [filteredCommits]);

  const goResult = (dir: -1 | 1) => {
    if (!filteredCommits || filteredCommits.length === 0) return;
    const next =
      (resultIndex + dir + filteredCommits.length) % filteredCommits.length;
    setResultIndex(next);
    void selectCommit(filteredCommits[next].hash);
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-[#171a20]">
      <div className="flex items-center gap-2 border-b border-[#2d3139] bg-[#1c1f26] px-2 py-1">
        <div className="flex min-w-0 flex-1 items-center gap-3 text-[8px] font-normal uppercase tracking-[0.1em] text-[#5c6370]">
          <div className="w-[138px] shrink-0">Branch / Tag</div>
          <div className="shrink-0" style={{ width: graphW }}>
            Graph
          </div>
          <div className="min-w-0 flex-1">Commit message</div>
          <div className="hidden w-36 shrink-0 lg:block">Author</div>
          <div className="w-14 shrink-0">SHA</div>
          <div className="w-12 shrink-0 text-right">When</div>
        </div>
      </div>

      {commitSearchOpen && (
        <div className="pointer-events-none absolute left-1/2 top-9 z-30 flex w-[min(520px,calc(100%-24px))] -translate-x-1/2 justify-center">
          <div className="pointer-events-auto flex w-full items-center gap-2 rounded-md border border-[#3d8bfd]/50 bg-[#1e3a5f] px-3 py-2 shadow-xl shadow-black/40">
            <IconSearch className="h-4 w-4 shrink-0 text-[#8bb4f0]" />
            <input
              ref={searchInputRef}
              className="h-6 min-w-0 flex-1 bg-transparent text-[12px] text-[#e8eaed] outline-none placeholder:text-[#8bb4f0]/70"
              placeholder="Find commit"
              value={commitQuery}
              onChange={(e) => setCommitQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (e.shiftKey) goResult(-1);
                  else if (searching && filteredCommits && filteredCommits.length > 0) {
                    goResult(1);
                  } else {
                    void searchCommits();
                  }
                }
                if (e.key === "Escape") void clearCommitSearch();
              }}
            />
            <span className="shrink-0 whitespace-nowrap text-[11px] text-[#8bb4f0]">
              {searching
                ? resultCount === 0
                  ? "0 results"
                  : `${resultIndex + 1} / ${resultCount}`
                : busy
                  ? "…"
                  : "Enter"}
            </span>
            <button
              type="button"
              title="Anterior"
              disabled={!searching || resultCount === 0}
              className="rounded px-1.5 py-0.5 text-[12px] text-[#c8ccd4] hover:bg-[#2a4a7a] disabled:opacity-30"
              onClick={() => goResult(-1)}
            >
              ↑
            </button>
            <button
              type="button"
              title="Próximo"
              disabled={!searching || resultCount === 0}
              className="rounded px-1.5 py-0.5 text-[12px] text-[#c8ccd4] hover:bg-[#2a4a7a] disabled:opacity-30"
              onClick={() => goResult(1)}
            >
              ↓
            </button>
            <button
              type="button"
              title="Fechar busca"
              className="rounded p-1 text-[#c8ccd4] hover:bg-[#2a4a7a]"
              onClick={() => void clearCommitSearch()}
            >
              <IconClose className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        <button
          type="button"
          onClick={() => void selectCommit(null)}
          className={`flex w-full items-center border-b border-[#2d3139]/50 px-2 text-left ${
            wipActive ? "bg-[#1e3a5f]/45" : "hover:bg-[#1c1f26]"
          }`}
          style={{ height: ROW_H }}
        >
          <div className="flex w-[138px] shrink-0 items-center">
            <span className="font-mono text-[11px] font-normal text-[#e3b341]">// WIP</span>
          </div>
          <div className="flex shrink-0 items-center justify-center" style={{ width: graphW }}>
            <span className="inline-block h-[14px] w-[14px] rounded-full border-2 border-dashed border-[#e3b341]" />
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-2 pl-2">
            {changeCount === 0 ? (
              <span className="text-[11px] text-[#5c6370]">Working directory clean</span>
            ) : (
              <>
                <Stat kind="mod" n={modified} />
                <Stat kind="add" n={added} />
                <Stat kind="del" n={deleted} />
              </>
            )}
          </div>
          <div className="hidden w-36 shrink-0 lg:block" />
          <div className="w-14 shrink-0" />
          <div className="w-12 shrink-0" />
        </button>

        <div className="relative flex">
          <div className="w-[138px] shrink-0">
            {commits.map((commit) => (
              <div
                key={`ref-${commit.hash}`}
                className="flex items-center gap-1 overflow-hidden px-2"
                style={{ height: ROW_H }}
              >
                {commit.refs.slice(0, 2).map((refName) => {
                  const label = shortRef(refName);
                  const isLocalHead =
                    status?.branch === label && !refName.includes("remotes/");
                  return (
                    <span
                      key={refName}
                      className={`inline-flex max-w-[128px] items-center gap-1 truncate rounded px-1.5 py-px text-[9px] font-normal ${
                        isLocalHead
                          ? "bg-[#238636] text-white"
                          : refName.includes("remotes/")
                            ? "bg-[#252830] text-[#8b909a]"
                            : "bg-[#238636]/20 text-[#3dd68c]"
                      }`}
                      title={label}
                    >
                      {isLocalHead && <span className="text-[8px]">✓</span>}
                      {label}
                    </span>
                  );
                })}
              </div>
            ))}
          </div>

          <GraphColumn commits={commits} maxLane={maxLane} showAvatars={showAvatars} />

          <ul className="min-w-0 flex-1">
            {commits.map((commit) => {
              const isSel = commit.hash === selectedCommitHash;
              return (
                <li key={commit.hash} style={{ height: ROW_H }}>
                  <button
                    type="button"
                    onClick={() => void selectCommit(commit.hash)}
                    className={`flex h-full w-full items-center gap-2 px-2 text-left ${
                      isSel ? "bg-[#1e3a5f]" : "hover:bg-[#1c1f26]"
                    }`}
                  >
                    <div className="min-w-0 flex-1 truncate text-[12px] font-normal text-[#d0d4dc]">
                      {commit.subject}
                    </div>
                    <div className="hidden w-36 shrink-0 items-center gap-1.5 lg:flex">
                      {showAvatars && (
                        <AuthorAvatar
                          name={commit.authorName}
                          email={commit.authorEmail}
                          size={16}
                        />
                      )}
                      <span className="min-w-0 truncate text-[10px] font-normal text-[#8b909a]">
                        {commit.authorName}
                      </span>
                    </div>
                    <div className="w-14 shrink-0 font-mono text-[10px] font-normal text-[#5c6370]">
                      {commit.shortHash}
                    </div>
                    <div className="w-12 shrink-0 text-right text-[10px] font-normal text-[#5c6370]">
                      {relativeDates
                        ? relativeTime(commit.authoredAt)
                        : new Date(commit.authoredAt).toLocaleDateString("pt-BR")}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {commits.length === 0 && (
          <div className="p-6 text-center text-[12px] text-[#5c6370]">
            Nenhum commit no histórico.
          </div>
        )}
      </div>
    </div>
  );
}
