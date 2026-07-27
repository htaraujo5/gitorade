import { useMemo, useRef, useEffect, useState, type MouseEvent } from "react";
import { useAppStore } from "../../stores/appStore";
import { usePrefsStore } from "../../stores/prefsStore";
import type { CommitSummary } from "../../lib/api";
import { checkoutTargetFromRef, commitHasBranch } from "../../lib/branchGraph";
import { groupRefsForCommit, remotesLookLikeGithub } from "../../lib/refDecorate";
import { requireDangerousConfirm } from "../../lib/dangerousConfirm";
import { dateLocale, translate, useLocale, useT, type MessageKey } from "../../i18n";
import { IconClose, IconCloud, IconGithub, IconLaptop, IconSearch, IconTag } from "../Icons";
import { UserAvatar } from "../UserAvatar";
import { ContextMenu, type ContextMenuItem } from "../layout/ContextMenu";

/** Alias kept for graph call sites. */
const AuthorAvatar = UserAvatar;

const LANE_COLORS = ["#3dd68c", "#3d8bfd", "#e3b341", "#a371f7", "#f778ba", "#f85149", "#56d4dd"];
const ROW_H = 32;
const LANE_W = 16;
const NODE_R = 7;
const GRAPH_PAD = 8;
const REF_COL_W = 140;

function relativeTime(iso: string, locale: "pt-BR" | "en"): string {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return iso;
  const mins = Math.floor((Date.now() - parsed) / 60000);
  if (mins < 1) return translate(locale, "graph.time.now");
  if (mins < 60) return translate(locale, "graph.time.m", { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return translate(locale, "graph.time.h", { n: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return translate(locale, "graph.time.d", { n: days });
  return new Date(parsed).toLocaleDateString(dateLocale(locale), {
    day: "2-digit",
    month: "short",
  });
}

function RefLocationIcons({
  isLocal,
  remoteName,
  useGithub,
  t,
}: {
  isLocal: boolean;
  remoteName: string | null;
  useGithub: boolean;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
}) {
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5 opacity-90">
      {isLocal && (
        <span title={t("graph.ref.local")} className="inline-flex">
          <IconLaptop className="h-2.5 w-2.5" />
        </span>
      )}
      {remoteName && (
        <span title={t("graph.ref.remote", { name: remoteName })} className="inline-flex">
          {useGithub ? (
            <IconGithub className="h-2.5 w-2.5" />
          ) : (
            <IconCloud className="h-2.5 w-2.5" />
          )}
        </span>
      )}
    </span>
  );
}

function GraphColumn({
  commits,
  maxLane,
  showAvatars,
  avatarByEmail,
}: {
  commits: CommitSummary[];
  maxLane: number;
  showAvatars: boolean;
  avatarByEmail: Map<string, string>;
}) {
  const width = Math.max((maxLane + 1) * LANE_W + GRAPH_PAD * 2, 28);
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
          const cx = GRAPH_PAD + commit.lane * LANE_W;
          const cy = row * ROW_H + ROW_H / 2;
          const parentRows = commit.parents
            .map((p) => hashIndex.get(p))
            .filter((i): i is number => i !== undefined && i > row);

          return (
            <g key={`edge-${commit.hash}`}>
              {parentRows.map((pRow, idx) => {
                const parent = commits[pRow];
                const px = GRAPH_PAD + parent.lane * LANE_W;
                const py = pRow * ROW_H + ROW_H / 2;
                const stroke =
                  LANE_COLORS[(idx === 0 ? commit.lane : parent.lane) % LANE_COLORS.length];
                const midY = (cy + py) / 2;
                return (
                  <path
                    key={`${commit.hash}-${parent.hash}`}
                    d={`M ${cx} ${cy + NODE_R} C ${cx} ${midY}, ${px} ${midY}, ${px} ${py - NODE_R}`}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={2}
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
        const cx = GRAPH_PAD + commit.lane * LANE_W;
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
              padding: showAvatars ? 1.5 : 0,
            }}
          >
            {showAvatars ? (
              <AuthorAvatar
                name={commit.authorName}
                email={commit.authorEmail}
                src={avatarByEmail.get(commit.authorEmail.trim().toLowerCase())}
                size={size - 3}
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

function Stat({ kind, n }: { kind: "add" | "mod" | "del"; n: number }) {
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
  const t = useT();
  const locale = useLocale();
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
    selectedBranchName,
    focusBranchInGraph,
    checkoutBranch,
    checkoutCommit,
    createBranch,
    cherryPick,
    resetToCommit,
    revertCommit,
    pull,
    push,
    remotes,
    status,
    busy,
    profiles,
  } = useAppStore();

  const showAvatars = usePrefsStore((s) => s.showAvatars);
  const relativeDates = usePrefsStore((s) => s.relativeDates);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listScrollRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<string, HTMLElement>());
  const [resultIndex, setResultIndex] = useState(0);
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    commit: CommitSummary;
  } | null>(null);

  const avatarByEmail = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of profiles) {
      const data = p.avatarData?.trim();
      if (!data) continue;
      m.set(p.email.trim().toLowerCase(), data);
    }
    return m;
  }, [profiles]);

  const commits = useMemo(() => {
    const raw = filteredCommits ?? graph?.commits ?? [];
    // Dense remap so sparse/high lane indices never stretch the column.
    const used = [...new Set(raw.map((c) => c.lane))].sort((a, b) => a - b);
    const remap = new Map(used.map((lane, i) => [lane, i]));
    return raw.map((c) => ({ ...c, lane: remap.get(c.lane) ?? 0 }));
  }, [filteredCommits, graph]);
  const maxLane = useMemo(() => commits.reduce((m, c) => Math.max(m, c.lane), 0), [commits]);
  const graphW = Math.max((maxLane + 1) * LANE_W + GRAPH_PAD * 2, 28);
  const changeCount = (status?.staged.length ?? 0) + (status?.unstaged.length ?? 0);
  const added =
    (status?.staged.filter((f) => f.status === "added" || f.status === "untracked").length ?? 0) +
    (status?.unstaged.filter((f) => f.status === "added" || f.status === "untracked").length ?? 0);
  const deleted =
    (status?.staged.filter((f) => f.status === "deleted").length ?? 0) +
    (status?.unstaged.filter((f) => f.status === "deleted").length ?? 0);
  const modified = Math.max(0, changeCount - added - deleted);
  const wipActive = selectedCommitHash === null;
  const conflictCount = status?.conflicts?.length ?? 0;
  const inProgress = status?.inProgress ?? null;
  const hasConflicts = conflictCount > 0;
  const integrateLabel =
    inProgress === "merge"
      ? "Merge"
      : inProgress === "rebase"
        ? "Rebase"
        : inProgress === "cherry-pick"
          ? "Cherry-pick"
          : inProgress
            ? inProgress
            : null;
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

  useEffect(() => {
    if (!selectedCommitHash) return;
    const el = rowRefs.current.get(selectedCommitHash);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [selectedCommitHash]);

  const goResult = (dir: -1 | 1) => {
    if (!filteredCommits || filteredCommits.length === 0) return;
    const next = (resultIndex + dir + filteredCommits.length) % filteredCommits.length;
    setResultIndex(next);
    void selectCommit(filteredCommits[next].hash);
  };

  const onRefClick = (e: MouseEvent, refName: string, commitHash: string) => {
    e.stopPropagation();
    const target = checkoutTargetFromRef(refName);
    void focusBranchInGraph(target);
    void selectCommit(commitHash);
  };

  const onRefDblClick = (e: MouseEvent, refName: string) => {
    e.stopPropagation();
    e.preventDefault();
    const target = checkoutTargetFromRef(refName);
    if (status?.branch === target) return;
    void checkoutBranch(target);
  };

  const onCommitDblClick = (e: MouseEvent, hash: string) => {
    e.preventDefault();
    void checkoutCommit(hash);
  };

  const currentBranch = status?.branch ?? "HEAD";
  const hasRemote = remotes.length > 0;
  const originUrl =
    remotes.find((r) => r.name === "origin")?.fetchUrl ??
    remotes.find((r) => r.name === "origin")?.pushUrl ??
    remotes[0]?.fetchUrl ??
    remotes[0]?.pushUrl ??
    null;

  const commitMenuItems = (commit: CommitSummary): ContextMenuItem[] => {
    const short = commit.shortHash || commit.hash.slice(0, 7);
    const branchLabel = currentBranch === "HEAD" ? "HEAD" : currentBranch;
    return [
      {
        type: "item",
        label: "Pull (fast-forward if possible)",
        disabled: busy || !hasRemote,
        onClick: () => void pull(),
      },
      {
        type: "item",
        label: "Pull --rebase",
        disabled: busy || !hasRemote,
        onClick: () => void pull({ rebase: true }),
      },
      {
        type: "item",
        label: "Push",
        disabled: busy || !hasRemote,
        onClick: () => void push({ setUpstream: false }),
      },
      {
        type: "item",
        label: "Set Upstream",
        disabled: busy || !hasRemote,
        onClick: () => void push({ setUpstream: true }),
      },
      { type: "separator" },
      {
        type: "item",
        label: "Checkout this commit",
        disabled: busy,
        onClick: () => void checkoutCommit(commit.hash),
      },
      {
        type: "item",
        label: "Create branch here…",
        disabled: busy,
        onClick: () => {
          const name = window.prompt(`Nova branch a partir de ${short}:`, `from-${short}`);
          if (!name?.trim()) return;
          void createBranch(name.trim(), true, commit.hash);
        },
      },
      { type: "separator" },
      {
        type: "item",
        label: `Reset ${branchLabel} to this commit (soft)…`,
        disabled: busy || currentBranch === "HEAD",
        onClick: () => void resetToCommit(commit.hash, "soft"),
      },
      {
        type: "item",
        label: `Reset ${branchLabel} to this commit (mixed)…`,
        disabled: busy || currentBranch === "HEAD",
        onClick: () => void resetToCommit(commit.hash, "mixed"),
      },
      {
        type: "item",
        label: `Reset ${branchLabel} to this commit (hard)…`,
        disabled: busy || currentBranch === "HEAD",
        danger: true,
        onClick: () => void resetToCommit(commit.hash, "hard"),
      },
      {
        type: "item",
        label: "Revert commit",
        disabled: busy,
        onClick: () => void revertCommit(commit.hash),
      },
      {
        type: "item",
        label: "Cherry-pick",
        disabled: busy,
        onClick: () => {
          if (requireDangerousConfirm(`Cherry-pick ${short}?`)) {
            void cherryPick(commit.hash);
          }
        },
      },
      { type: "separator" },
      {
        type: "item",
        label: "Copy commit sha",
        onClick: () => void navigator.clipboard.writeText(commit.hash),
      },
      {
        type: "item",
        label: "Copy subject",
        onClick: () => void navigator.clipboard.writeText(commit.subject),
      },
      {
        type: "item",
        label: "Copy link to this commit on remote",
        disabled: !originUrl,
        onClick: () => {
          const link = remoteCommitUrl(originUrl!, commit.hash);
          if (link) void navigator.clipboard.writeText(link);
          else void navigator.clipboard.writeText(`${originUrl} ${commit.hash}`);
        },
      },
    ];
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-[#171a20]">
      <div className="flex items-center gap-2 border-b border-[#2d3139] bg-[#1c1f26] px-2 py-1">
        <div className="flex min-w-0 flex-1 items-center gap-2 text-[8px] font-normal uppercase tracking-[0.1em] text-[#5c6370]">
          <div className="shrink-0" style={{ width: REF_COL_W }}>
            Branch / Tag
          </div>
          <div className="shrink-0" style={{ width: graphW }}>
            Graph
          </div>
          <div className="min-w-0 flex-1">Message</div>
          <div className="hidden w-40 shrink-0 xl:block">Author</div>
          <div className="w-16 shrink-0">When</div>
          <div className="w-16 shrink-0">Commit</div>
        </div>
      </div>

      {commitSearchOpen && (
        <div className="pointer-events-none absolute left-1/2 top-9 z-30 flex w-[min(520px,calc(100%-24px))] -translate-x-1/2 justify-center">
          <div className="pointer-events-auto flex w-full items-center gap-2 rounded-md border border-[#3d8bfd]/50 bg-[#1e3a5f] px-3 py-2 shadow-xl shadow-black/40">
            <IconSearch className="h-4 w-4 shrink-0 text-[#8bb4f0]" />
            <input
              ref={searchInputRef}
              className="h-6 min-w-0 flex-1 bg-transparent text-[12px] text-[#e8eaed] outline-none placeholder:text-[#8bb4f0]/70"
              placeholder={t("graph.search")}
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

      <div className="min-h-0 flex-1 overflow-auto" ref={listScrollRef}>
        <button
          type="button"
          onClick={() => void selectCommit(null)}
          className={`flex w-full items-center border-b border-[#2d3139]/50 px-2 text-left ${
            hasConflicts
              ? wipActive
                ? "bg-[#e3b341]/18"
                : "bg-[#e3b341]/08 hover:bg-[#e3b341]/14"
              : wipActive
                ? "bg-[#1e3a5f]/45"
                : "hover:bg-[#1c1f26]"
          }`}
          style={{ height: ROW_H }}
          title={
            hasConflicts
              ? `${conflictCount} arquivo(s) em conflito — abra no painel à direita`
              : undefined
          }
        >
          <div className="flex shrink-0 items-center gap-1" style={{ width: REF_COL_W }}>
            {hasConflicts ? (
              <span className="inline-flex items-center gap-1 truncate rounded bg-[#e3b341]/25 px-1.5 py-px text-[9px] font-medium text-[#e8c547]">
                ⚠ {integrateLabel ?? "Conflict"}
              </span>
            ) : (
              <span className="font-mono text-[11px] font-normal text-[#e3b341]">
                {t("graph.wip")}
              </span>
            )}
          </div>
          <div
            className="relative flex shrink-0 items-center justify-center"
            style={{ width: graphW }}
          >
            {hasConflicts ? (
              <>
                <span className="inline-block h-[12px] w-[12px] rounded-full border-2 border-[#e3b341] bg-[#e3b341]/35" />
                <span
                  className="absolute -right-0.5 -top-0.5 flex h-3 min-w-3 items-center justify-center rounded-full bg-[#e3b341] px-0.5 text-[7px] font-bold leading-none text-[#1a1d24]"
                  aria-hidden
                >
                  {conflictCount > 9 ? "!" : conflictCount}
                </span>
              </>
            ) : (
              <span className="inline-block h-[12px] w-[12px] rounded-full border-2 border-dashed border-[#e3b341]" />
            )}
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-2 pl-2">
            {hasConflicts ? (
              <>
                <span className="truncate text-[12px] font-medium text-[#e8c547]">
                  {conflictCount} file conflict{conflictCount === 1 ? "" : "s"}
                  {integrateLabel ? ` · ${integrateLabel} in progress` : ""}
                </span>
                {changeCount > 0 && (
                  <span className="flex shrink-0 items-center gap-1.5 opacity-80">
                    <Stat kind="mod" n={modified} />
                    <Stat kind="add" n={added} />
                    <Stat kind="del" n={deleted} />
                  </span>
                )}
              </>
            ) : changeCount === 0 ? (
              <span className="text-[11px] text-[#5c6370]">Working directory clean</span>
            ) : (
              <>
                <span className="font-mono text-[11px] text-[#e3b341]">{t("graph.wip")}</span>
                <Stat kind="mod" n={modified} />
                <Stat kind="add" n={added} />
                <Stat kind="del" n={deleted} />
              </>
            )}
          </div>
          <div className="hidden w-40 shrink-0 xl:block" />
          <div className="w-16 shrink-0" />
          <div className="w-16 shrink-0" />
        </button>

        <div className="relative flex min-w-0">
          <div className="shrink-0" style={{ width: REF_COL_W }}>
            {commits.map((commit) => {
              const pills = groupRefsForCommit(commit.refs, remotes).slice(0, 3);
              const useGithub = remotesLookLikeGithub(remotes);
              return (
                <div
                  key={`ref-${commit.hash}`}
                  className="flex items-center gap-1 overflow-hidden px-1"
                  style={{ height: ROW_H }}
                >
                  {pills.map((pill) => {
                    const isSelectedTip =
                      Boolean(selectedBranchName) && pill.label === selectedBranchName;
                    const titleParts = [
                      pill.isTag ? t("graph.ref.tag", { name: pill.label }) : pill.label,
                      pill.isLocal ? t("graph.ref.local") : null,
                      pill.remoteName ? t("graph.ref.remote", { name: pill.remoteName }) : null,
                      t("graph.ref.hint"),
                    ].filter(Boolean);
                    return (
                      <button
                        key={pill.key}
                        type="button"
                        title={titleParts.join(" · ")}
                        onClick={(e) => onRefClick(e, pill.primaryRef, commit.hash)}
                        onDoubleClick={(e) => onRefDblClick(e, pill.primaryRef)}
                        className={`inline-flex max-w-[128px] items-center gap-1 truncate rounded px-1.5 py-px text-[9px] font-normal transition-shadow ${
                          isSelectedTip
                            ? "ring-2 ring-[#3d8bfd] ring-offset-1 ring-offset-[#171a20]"
                            : ""
                        } ${
                          pill.isTag
                            ? "bg-[#1e3a5f] text-[#79b8ff] hover:bg-[#254a73]"
                            : pill.isHead && pill.label === "HEAD"
                              ? "bg-[#e3b341] text-[#1c1408]"
                              : pill.isHead
                                ? "bg-[#238636] text-white"
                                : pill.isLocal
                                  ? "bg-[#238636]/20 text-[#3dd68c] hover:bg-[#238636]/35"
                                  : "bg-[#252830] text-[#8b909a] hover:bg-[#2f3440]"
                        }`}
                      >
                        {pill.isHead && <span className="text-[8px]">✓</span>}
                        {pill.isTag && <IconTag className="h-2.5 w-2.5 shrink-0 opacity-90" />}
                        {!pill.isTag && pill.label !== "HEAD" && (
                          <RefLocationIcons
                            isLocal={pill.isLocal}
                            remoteName={pill.remoteName}
                            useGithub={useGithub}
                            t={t}
                          />
                        )}
                        <span className="truncate">{pill.label}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          <GraphColumn
            commits={commits}
            maxLane={maxLane}
            showAvatars={showAvatars}
            avatarByEmail={avatarByEmail}
          />

          <ul className="min-w-0 flex-1">
            {commits.map((commit) => {
              const isSel = commit.hash === selectedCommitHash;
              const isBranchTip =
                Boolean(selectedBranchName) && commitHasBranch(commit, selectedBranchName!);
              return (
                <li
                  key={commit.hash}
                  style={{ height: ROW_H }}
                  ref={(el) => {
                    if (el) rowRefs.current.set(commit.hash, el);
                    else rowRefs.current.delete(commit.hash);
                  }}
                >
                  <button
                    type="button"
                    title="Clique: selecionar · 2 cliques: checkout · botão direito: ações"
                    onClick={() => void selectCommit(commit.hash)}
                    onDoubleClick={(e) => onCommitDblClick(e, commit.hash)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void selectCommit(commit.hash);
                      setMenu({ x: e.clientX, y: e.clientY, commit });
                    }}
                    className={`flex h-full w-full items-center gap-2 px-2 text-left ${
                      isSel
                        ? "bg-[#1e3a5f]"
                        : isBranchTip
                          ? "bg-[#1e3a5f]/35 hover:bg-[#1e3a5f]/55"
                          : "hover:bg-[#1c1f26]"
                    }`}
                  >
                    <div className="min-w-0 flex-1 truncate text-[12px] font-normal text-[#d0d4dc]">
                      {commit.subject}
                    </div>
                    <div className="hidden w-40 shrink-0 items-center gap-1.5 xl:flex">
                      {showAvatars && (
                        <AuthorAvatar
                          name={commit.authorName}
                          email={commit.authorEmail}
                          src={avatarByEmail.get(commit.authorEmail.trim().toLowerCase())}
                          size={22}
                        />
                      )}
                      <span className="min-w-0 truncate text-[10px] font-normal text-[#8b909a]">
                        {commit.authorName}
                      </span>
                    </div>
                    <div className="w-16 shrink-0 text-right text-[10px] font-normal text-[#5c6370]">
                      {relativeDates
                        ? relativeTime(commit.authoredAt, locale)
                        : new Date(commit.authoredAt).toLocaleDateString(dateLocale(locale))}
                    </div>
                    <div className="w-16 shrink-0 font-mono text-[10px] font-normal text-[#5c6370]">
                      {commit.shortHash}
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

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={commitMenuItems(menu.commit)}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}

/** Best-effort commit URL for GitHub / Azure DevOps / GitLab. */
function remoteCommitUrl(remoteUrl: string, hash: string): string | null {
  let u = remoteUrl.trim();
  if (!u) return null;
  // git@host:org/repo.git → https://host/org/repo
  const ssh = /^git@([^:]+):(.+?)(?:\.git)?$/i.exec(u);
  if (ssh) {
    u = `https://${ssh[1]}/${ssh[2]}`;
  } else {
    u = u.replace(/\.git$/i, "");
  }
  try {
    const url = new URL(u);
    const host = url.hostname.toLowerCase();
    const path = url.pathname.replace(/\/$/, "");
    if (host.includes("github")) return `${url.origin}${path}/commit/${hash}`;
    if (host.includes("gitlab")) return `${url.origin}${path}/-/commit/${hash}`;
    if (host.includes("dev.azure.com") || host.includes("visualstudio.com")) {
      return `${url.origin}${path}/commit/${hash}`;
    }
    return `${url.origin}${path}/commit/${hash}`;
  } catch {
    return null;
  }
}
