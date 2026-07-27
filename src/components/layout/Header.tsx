import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAppStore } from "../../stores/appStore";
import {
  IconBranch,
  IconCommit,
  IconFetch,
  IconMerge,
  IconPull,
  IconPush,
  IconRefresh,
  IconSearch,
  IconStash,
  IconTerminal,
} from "../Icons";

/**
 * Second header row (GitKraken-style): repo/branch + git actions.
 * Only shown when the active shell tab is a repository.
 */
export function RepoToolbar() {
  const {
    repositories,
    activeRepoId,
    selectRepository,
    status,
    remotes,
    branches,
    operation,
    setWorkspaceTab,
    checkoutBranch,
    refreshStatus,
    fetch,
    pull,
    push,
    setTerminalOpen,
    terminalOpen,
    selectCommit,
    busy,
    commitSearchOpen,
    setCommitSearchOpen,
    openStagingStash,
    setStagingPanelMode,
  } = useAppStore();

  const repo = repositories.find((r) => r.id === activeRepoId);
  const branch = status?.branch ?? repo?.branch ?? "";
  const opRunning = Boolean(operation && !operation.done);
  const disabled = !repo || busy || opRunning;
  const localBranches = branches.filter((b) => !b.isRemote);
  const changeCount =
    (status?.staged.length ?? 0) + (status?.unstaged.length ?? 0);
  const conflictCount = status?.conflicts?.length ?? 0;

  return (
    <header className="relative z-40 shrink-0 border-b border-[#2d3139] bg-[#1c1f26]">
      <div className="flex h-[44px] items-center gap-3 px-2.5">
        <div className="flex min-w-0 items-end gap-2">
          <Breadcrumb
            label="repository"
            value={
              <HeaderSelect
                value={activeRepoId ?? ""}
                display={repo?.name ?? "—"}
                options={repositories.map((r) => ({
                  value: r.id,
                  label: r.name,
                }))}
                onChange={(id) => void selectRepository(id)}
                maxWidth={150}
              />
            }
          />
          <span className="mb-1 text-[10px] leading-none text-[#5c6370]">›</span>
          <Breadcrumb
            label="branch"
            value={
              <HeaderSelect
                value={branch}
                display={branch || "—"}
                accent
                disabled={disabled || localBranches.length === 0}
                options={localBranches.map((b) => ({
                  value: b.name,
                  label: b.name,
                }))}
                onChange={(name) => {
                  if (name !== branch) void checkoutBranch(name);
                }}
                maxWidth={140}
              />
            }
          />
          {conflictCount > 0 ? (
            <button
              type="button"
              className="mb-0.5 rounded bg-[#e3b341]/20 px-1.5 py-0.5 text-[9px] font-medium text-[#e8c547]"
              onClick={() => {
                void selectCommit(null);
                setWorkspaceTab("graph");
              }}
            >
              ⚠ {conflictCount} conflict{conflictCount === 1 ? "" : "s"}
            </button>
          ) : (
            changeCount > 0 && (
              <button
                type="button"
                className="mb-0.5 rounded bg-[#e3b341]/10 px-1.5 py-0.5 font-mono text-[9px] font-normal text-[#e3b341]"
                onClick={() => {
                  void selectCommit(null);
                  setWorkspaceTab("graph");
                }}
              >
                // WIP · {changeCount.toLocaleString()}
              </button>
            )
          )}
        </div>

        <div
          className="mx-auto flex h-full items-center gap-px"
          role="toolbar"
          aria-label="Ações Git"
        >
          <Tool
            label="Commit"
            icon={<IconCommit className="h-5 w-5" />}
            disabled={disabled}
            onClick={() => {
              void selectCommit(null);
              setWorkspaceTab("graph");
              setStagingPanelMode("commit");
            }}
          />
          <Tool
            label="Pull"
            icon={<IconPull className="h-5 w-5" />}
            disabled={disabled}
            onClick={() => void pull()}
          />
          <Tool
            label="Push"
            icon={<IconPush className="h-5 w-5" />}
            disabled={disabled}
            onClick={() => void push()}
          />
          <Tool
            label="Fetch"
            icon={<IconFetch className="h-5 w-5" />}
            disabled={disabled}
            onClick={() => void fetch()}
          />
          <Tool
            label="Branch"
            icon={<IconBranch className="h-5 w-5" />}
            disabled={disabled}
            onClick={() => setWorkspaceTab("branches")}
          />
          <Tool
            label="Merge"
            icon={<IconMerge className="h-5 w-5" />}
            disabled={disabled}
            onClick={() => setWorkspaceTab("branches")}
          />
          <Tool
            label="Stash"
            icon={<IconStash className="h-5 w-5" />}
            disabled={disabled}
            onClick={() => openStagingStash()}
          />
          <div className="mx-1 h-7 w-px bg-[#2d3139]" />
          <Tool
            label="Terminal"
            icon={<IconTerminal className="h-5 w-5" />}
            disabled={false}
            active={terminalOpen}
            onClick={() => setTerminalOpen(!terminalOpen)}
          />
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <Tool
            label="Search"
            icon={<IconSearch className="h-5 w-5" />}
            disabled={disabled}
            active={commitSearchOpen}
            onClick={() => {
              setWorkspaceTab("graph");
              if (commitSearchOpen) void useAppStore.getState().clearCommitSearch();
              else setCommitSearchOpen(true);
            }}
          />
          <button
            type="button"
            title={
              remotes.length === 0
                ? "Refresh · sem remote"
                : `Refresh · ${remotes.map((r) => r.name).join(", ")}`
            }
            disabled={disabled}
            onClick={() => void refreshStatus()}
            className="rounded p-1.5 text-[#b8bcc6] hover:bg-[#2a2e38] hover:text-[#f0f1f4] disabled:opacity-40"
          >
            <IconRefresh className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

function Breadcrumb({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[8px] font-normal uppercase tracking-[0.06em] text-[#6b7280]">
        {label}
      </span>
      {value}
    </div>
  );
}

function HeaderSelect({
  value,
  display,
  options,
  onChange,
  disabled,
  accent,
  maxWidth = 140,
}: {
  value: string;
  display: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
  accent?: boolean;
  maxWidth?: number;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`flex max-w-full items-center gap-1 rounded px-1 py-0.5 text-left outline-none hover:bg-[#2a2e38] disabled:cursor-not-allowed disabled:opacity-50 ${
          open ? "bg-[#2a2e38] ring-1 ring-[#3d8bfd]/60" : ""
        }`}
        style={{ maxWidth }}
      >
        <span
          className={`min-w-0 truncate text-[11px] font-normal ${
            accent ? "text-[#3dd68c]" : "text-[#d8dbe2]"
          }`}
        >
          {display}
        </span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 16 16"
          fill="none"
          className={`shrink-0 ${accent ? "text-[#3dd68c]" : "text-[#6b7280]"}`}
          aria-hidden
        >
          <path
            d="M4 6l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div
          className="absolute left-0 top-[calc(100%+4px)] z-[60] max-h-64 min-w-[160px] overflow-auto rounded-md border border-[#3a3f4b] bg-[#252830] py-1 shadow-2xl shadow-black/50"
          style={{ width: Math.max(maxWidth, 180) }}
        >
          {options.length === 0 ? (
            <div className="px-3 py-2 text-[11px] text-[#8b909a]">Nenhum item</div>
          ) : (
            options.map((opt) => {
              const selected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={`flex w-full items-center px-3 py-1.5 text-left text-[11px] hover:bg-[#2f3440] ${
                    selected ? "bg-[#1e3a5f] text-[#d8dbe2]" : "text-[#c5c9d2]"
                  }`}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                >
                  <span className="truncate">{opt.label}</span>
                  {selected && (
                    <span className="ml-auto pl-2 text-[10px] text-[#3dd68c]">✓</span>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function Tool({
  icon,
  label,
  disabled,
  onClick,
  active,
}: {
  icon: ReactNode;
  label: string;
  disabled: boolean;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={label}
      className={`flex w-[50px] flex-col items-center justify-center gap-0.5 rounded px-0.5 py-1 transition disabled:cursor-not-allowed disabled:opacity-28 ${
        active
          ? "bg-[#2a2e38] text-[#d8dbe2]"
          : "text-[#a8adb8] hover:bg-[#2a2e38] hover:text-[#d8dbe2]"
      }`}
    >
      <span className="text-[8px] font-normal leading-none tracking-[0.04em] text-[#8b909a]">
        {label}
      </span>
      <span className="leading-none">{icon}</span>
    </button>
  );
}

/** @deprecated use RepoToolbar — kept for any leftover imports */
export const Header = RepoToolbar;
