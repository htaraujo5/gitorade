import { useMemo, useState, type ReactNode } from "react";
import { useAppStore } from "../../stores/appStore";
import type { FileChange } from "../../lib/api";
import { IconBranch, IconStash } from "../Icons";

type ViewMode = "path" | "tree";

function relativeTime(iso?: string | null): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(mins, 1)} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.floor(hours / 24)} d`;
}

/**
 * Commit panel like GitKraken:
 * - file changes (unstaged / staged)
 * - unified Commit | Stash | Sync writing block
 */
export function StagingPanel() {
  const {
    status,
    stage,
    unstage,
    selectFile,
    selectedFile,
    commitMessage,
    setCommitMessage,
    commit,
    push,
    busy,
    remotes,
    addRemote,
    repositories,
    activeRepoId,
    profiles,
    commitOverrideProfileId,
    stagingPanelMode,
    setStagingPanelMode,
    stash,
    createStash,
    applyStash,
    dropStash,
  } = useAppStore();

  const [description, setDescription] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("path");
  const [amend, setAmend] = useState(false);
  const [pushAfter, setPushAfter] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(true);
  const [stashMessage, setStashMessage] = useState("");
  const [stashDescription, setStashDescription] = useState("");

  const repo = repositories.find((r) => r.id === activeRepoId);
  const activeProfile =
    profiles.find((p) => p.id === commitOverrideProfileId) ??
    repo?.activeProfile ??
    profiles[0] ??
    null;

  const staged = status?.staged ?? [];
  const unstaged = status?.unstaged ?? [];
  const total = staged.length + unstaged.length;
  const summaryLen = commitMessage.length;
  const mode = stagingPanelMode === "stash" ? "stash" : "commit";

  const primaryDisabled =
    !repo ||
    busy ||
    !activeProfile ||
    (staged.length > 0 && !commitMessage.trim()) ||
    (staged.length === 0 && unstaged.length === 0);

  const canStashPush = total > 0 && !busy;

  const runCommit = async () => {
    if (staged.length === 0) {
      void stage(unstaged.map((f) => f.path));
      return;
    }
    const summary = commitMessage.trim();
    const body = description.trim();
    if (body) setCommitMessage(`${summary}\n\n${body}`);
    setDescription("");
    await commit();
    if (pushAfter) void push();
  };

  return (
    <aside className="flex w-[300px] shrink-0 flex-col border-l border-[#2d3139] bg-[#1c1f26]">
      <div className="flex items-center justify-between gap-2 border-b border-[#2d3139] px-2.5 py-2">
        <div className="min-w-0 text-[11px] font-normal leading-snug text-[#a0a6b0]">
          <span className="text-[#d8dbe2]">{total.toLocaleString()}</span> file changes
          {status?.branch ? (
            <span className="text-[#6b7280]"> on {status.branch}</span>
          ) : null}
        </div>
        <div className="flex shrink-0 rounded border border-[#2d3139] p-px text-[9px]">
          <ToggleBtn active={viewMode === "path"} onClick={() => setViewMode("path")}>
            Path
          </ToggleBtn>
          <ToggleBtn active={viewMode === "tree"} onClick={() => setViewMode("tree")}>
            Tree
          </ToggleBtn>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <FileSection
          title="Unstaged Files"
          files={unstaged}
          viewMode={viewMode}
          allLabel="Stage All Changes"
          onAll={() => void stage(unstaged.map((f) => f.path))}
          onOne={(p) => void stage([p])}
          onSelect={(f) => void selectFile(f)}
          selected={selectedFile}
          disabled={busy}
          allAccent="success"
        />
        <FileSection
          title="Staged Files"
          files={staged}
          viewMode={viewMode}
          allLabel="Unstage All Changes"
          onAll={() => void unstage(staged.map((f) => f.path))}
          onOne={(p) => void unstage([p])}
          onSelect={(f) => void selectFile(f)}
          selected={selectedFile}
          disabled={busy}
          allAccent="muted"
        />
        {remotes.length === 0 && <RemoteQuickAdd busy={busy} onAdd={addRemote} />}
      </div>

      <div className="shrink-0 border-t border-[#2d3139] bg-[#171a20] p-2">
        <div className="overflow-hidden rounded-md border border-[#2d3139] bg-[#1c1f26]">
          <div className="flex border-b border-[#2d3139]">
            <PanelTab
              active={mode === "commit"}
              onClick={() => setStagingPanelMode("commit")}
              title="Commit"
            >
              <IconBranch className="h-3.5 w-3.5" />
              Commit
            </PanelTab>
            <PanelTab
              active={mode === "stash"}
              onClick={() => setStagingPanelMode("stash")}
              title="Stash"
            >
              <IconStash className="h-3.5 w-3.5" />
              {stash.length > 0 ? (
                <span className="tabular-nums">{stash.length}</span>
              ) : null}
            </PanelTab>
          </div>

          <div className="max-h-[280px] space-y-2 overflow-auto p-2.5">
            {mode === "commit" && (
              <>
                <label className="flex items-center gap-1.5 text-[10px] text-[#8b909a]">
                  <input
                    type="checkbox"
                    checked={amend}
                    onChange={(e) => setAmend(e.target.checked)}
                    className="h-3 w-3 rounded border-[#2d3139]"
                  />
                  Amend previous commit
                </label>

                <div className="relative overflow-hidden rounded border border-[#2d3139] bg-[#12141a]">
                  <span
                    className={`pointer-events-none absolute right-2 top-2 text-[9px] tabular-nums ${
                      summaryLen > 72 ? "text-[#e3b341]" : "text-[#5c6370]"
                    }`}
                  >
                    {Math.max(0, 72 - summaryLen)}
                  </span>
                  <input
                    className="h-9 w-full bg-transparent px-2 pr-8 text-[13px] leading-snug text-[#e8eaed] outline-none ring-0 placeholder:text-[#5c6370] focus:outline-none focus:ring-0"
                    placeholder="Commit summary"
                    value={commitMessage}
                    disabled={!repo || busy}
                    maxLength={200}
                    onChange={(e) => setCommitMessage(e.target.value)}
                  />
                  <textarea
                    className="h-16 w-full resize-none bg-transparent px-2 pb-1.5 text-[11px] leading-snug text-[#e8eaed] outline-none ring-0 placeholder:text-[#5c6370] focus:outline-none focus:ring-0"
                    placeholder="Description"
                    value={description}
                    disabled={!repo || busy}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => setOptionsOpen((v) => !v)}
                    className="flex w-full items-center gap-1 text-[10px] text-[#8b909a] hover:text-[#c8ccd4]"
                  >
                    <span className="text-[8px] opacity-70">{optionsOpen ? "▾" : "▸"}</span>
                    Commit options
                  </button>
                  {optionsOpen && (
                    <label className="mt-1.5 flex items-center gap-1.5 pl-3 text-[10px] text-[#8b909a]">
                      <input
                        type="checkbox"
                        checked={pushAfter}
                        onChange={(e) => setPushAfter(e.target.checked)}
                        className="h-3 w-3 rounded border-[#2d3139]"
                      />
                      Push after committing
                    </label>
                  )}
                </div>

                <button
                  type="button"
                  disabled={primaryDisabled}
                  onClick={() => void runCommit()}
                  className="flex w-full items-center justify-center gap-1.5 rounded border border-[#238636] bg-[#238636]/15 py-2 text-[12px] font-medium text-[#3dd68c] hover:bg-[#238636]/25 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <IconBranch className="h-3.5 w-3.5" />
                  {staged.length === 0
                    ? "Stage Changes to Commit"
                    : `Commit to ${status?.branch ?? "HEAD"}`}
                </button>

                {!activeProfile && (
                  <p className="text-[10px] text-[#e3b341]">
                    Selecione um perfil no menu do canto superior direito.
                  </p>
                )}
                {amend && (
                  <p className="text-[10px] text-[#e3b341]">
                    Amend em breve — cria commit novo por agora.
                  </p>
                )}
              </>
            )}

            {mode === "stash" && (
              <>
                <div className="overflow-hidden rounded border border-[#2d3139] bg-[#12141a]">
                  <input
                    className="h-9 w-full bg-transparent px-2 text-[13px] leading-snug text-[#e8eaed] outline-none ring-0 placeholder:text-[#5c6370] focus:outline-none focus:ring-0"
                    placeholder="Stash title"
                    value={stashMessage}
                    disabled={!canStashPush && total === 0}
                    onChange={(e) => setStashMessage(e.target.value)}
                  />
                  <textarea
                    className="h-16 w-full resize-none bg-transparent px-2 pb-1.5 text-[11px] leading-snug text-[#e8eaed] outline-none ring-0 placeholder:text-[#5c6370] focus:outline-none focus:ring-0"
                    placeholder="Description"
                    value={stashDescription}
                    disabled={!canStashPush && total === 0}
                    onChange={(e) => setStashDescription(e.target.value)}
                  />
                </div>

                <button
                  type="button"
                  disabled={!canStashPush}
                  title={
                    total === 0
                      ? "Sem alterações para guardar"
                      : "Guardar alterações no stash"
                  }
                  onClick={() => {
                    const title = stashMessage.trim();
                    const body = stashDescription.trim();
                    const msg =
                      title && body
                        ? `${title}\n\n${body}`
                        : title || body || undefined;
                    void createStash(msg);
                    setStashMessage("");
                    setStashDescription("");
                  }}
                  className="flex w-full items-center justify-center gap-1.5 rounded border border-[#238636] bg-[#238636]/15 py-2 text-[12px] font-medium text-[#3dd68c] hover:bg-[#238636]/25 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <IconStash className="h-3.5 w-3.5" />
                  Stage Changes to Stash
                </button>

                <div className="max-h-28 overflow-auto rounded border border-[#2d3139]/80">
                  {stash.length === 0 ? (
                    <p className="px-2 py-2 text-[10px] text-[#5c6370]">
                      {total === 0
                        ? "Nenhum stash · working tree limpo"
                        : `${total} alteração(ões) prontas para stash`}
                    </p>
                  ) : (
                    <ul>
                      {stash.map((entry) => (
                        <li
                          key={entry.selector}
                          className="border-b border-[#2d3139]/50 px-2 py-1.5 last:border-0"
                        >
                          <div className="truncate text-[11px] text-[#e8eaed]">
                            {entry.message || entry.selector}
                          </div>
                          <div className="mt-0.5 font-mono text-[9px] text-[#5c6370]">
                            {entry.selector}
                            {entry.authoredAt
                              ? ` · ${relativeTime(entry.authoredAt)}`
                              : ""}
                          </div>
                          <div className="mt-1 flex gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              className="text-[10px] text-[#3d8bfd] hover:underline disabled:opacity-40"
                              onClick={() => void applyStash(entry.selector, false)}
                            >
                              Apply
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              className="text-[10px] text-[#3d8bfd] hover:underline disabled:opacity-40"
                              onClick={() => void applyStash(entry.selector, true)}
                            >
                              Pop
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              className="text-[10px] text-[#f85149] hover:underline disabled:opacity-40"
                              onClick={() => {
                                if (window.confirm(`Remover ${entry.selector}?`)) {
                                  void dropStash(entry.selector);
                                }
                              }}
                            >
                              Drop
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

function PanelTab({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`flex min-w-0 flex-1 items-center justify-center gap-1 border-b-2 px-1 py-1.5 text-[10px] font-medium ${
        active
          ? "border-[#3d8bfd] bg-[#1e3a5f]/35 text-[#e8eaed]"
          : "border-transparent text-[#6b7280] hover:bg-[#252830] hover:text-[#c8ccd4]"
      }`}
    >
      {children}
    </button>
  );
}

function ToggleBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-1.5 py-0.5 ${
        active ? "bg-[#2a2e38] text-[#e8eaed]" : "text-[#6b7280]"
      }`}
    >
      {children}
    </button>
  );
}

function FileSection({
  title,
  files,
  viewMode,
  allLabel,
  onAll,
  onOne,
  onSelect,
  selected,
  disabled,
  allAccent,
}: {
  title: string;
  files: FileChange[];
  viewMode: ViewMode;
  allLabel: string;
  onAll: () => void;
  onOne: (path: string) => void;
  onSelect: (f: FileChange) => void;
  selected: { path: string; staged: boolean } | null;
  disabled: boolean;
  allAccent: "success" | "muted";
}) {
  const display = useMemo(() => {
    if (viewMode === "path") return files;
    return [...files].sort((a, b) => a.path.localeCompare(b.path));
  }, [files, viewMode]);

  const MAX = 500;
  const visible = display.slice(0, MAX);
  const rest = display.length - visible.length;

  return (
    <div className="border-b border-[#2d3139]/80">
      <div className="px-2.5 py-1.5 text-[9px] font-normal uppercase tracking-[0.08em] text-[#6b7280]">
        {title} ({files.length.toLocaleString()})
      </div>
      {files.length > 0 && (
        <button
          type="button"
          disabled={disabled}
          onClick={onAll}
          className={`mx-2 mb-1.5 w-[calc(100%-1rem)] rounded py-1.5 text-[11px] font-normal disabled:opacity-40 ${
            allAccent === "success"
              ? "bg-[#238636] text-white hover:bg-[#2ea043]"
              : "border border-[#2d3139] text-[#c8ccd4] hover:bg-[#2a2e38]"
          }`}
        >
          {allLabel}
        </button>
      )}
      {files.length === 0 ? (
        <p className="px-2.5 pb-2 text-[10px] text-[#5c6370]">No files</p>
      ) : (
        <ul className="pb-1">
          {visible.map((file) => {
            const isSel =
              selected?.path === file.path && selected.staged === file.staged;
            const base = file.path.includes("/")
              ? file.path.slice(file.path.lastIndexOf("/") + 1)
              : file.path;
            const dir = file.path.includes("/")
              ? file.path.slice(0, file.path.lastIndexOf("/"))
              : "";
            return (
              <li key={`${file.staged}-${file.path}`}>
                <div
                  className={`group flex h-6 items-center gap-1 px-1.5 ${
                    isSel ? "bg-[#1e3a5f]" : "hover:bg-[#252830]"
                  }`}
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-left"
                    onClick={() => onSelect(file)}
                    title={file.path}
                  >
                    <StatusGlyph status={file.status} />
                    <span className="min-w-0 truncate font-mono text-[11px] leading-none text-[#c8ccd4]">
                      {viewMode === "tree" && dir ? (
                        <>
                          <span className="text-[#5c6370]">{dir}/</span>
                          {base}
                        </>
                      ) : (
                        base
                      )}
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    title={allAccent === "success" ? "Stage" : "Unstage"}
                    className="invisible shrink-0 rounded px-1 text-[9px] font-medium text-[#3d8bfd] group-hover:visible hover:bg-[#2a2e38] disabled:opacity-40"
                    onClick={() => onOne(file.path)}
                  >
                    {allAccent === "success" ? "+" : "−"}
                  </button>
                </div>
              </li>
            );
          })}
          {rest > 0 && (
            <li className="px-2.5 py-1.5 text-[10px] text-[#5c6370]">
              +{rest.toLocaleString()} more
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function StatusGlyph({ status }: { status: string }) {
  if (status === "added" || status === "untracked") {
    return (
      <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center text-[11px] font-bold leading-none text-[#3dd68c]">
        +
      </span>
    );
  }
  if (status === "deleted") {
    return (
      <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center text-[11px] font-bold leading-none text-[#f85149]">
        −
      </span>
    );
  }
  return (
    <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center text-[10px] font-bold leading-none text-[#e3b341]">
      /
    </span>
  );
}

function RemoteQuickAdd({
  onAdd,
  busy,
}: {
  onAdd: (name: string, url: string) => Promise<void>;
  busy: boolean;
}) {
  const [url, setUrl] = useState("");
  return (
    <div className="m-2 rounded border border-[#e3b341]/30 bg-[#e3b341]/8 p-2">
      <div className="mb-1 text-[9px] font-bold uppercase tracking-wide text-[#e3b341]">
        Sem remote
      </div>
      <p className="mb-1.5 text-[10px] leading-snug text-[#a89050]">
        Este repositório não tem remote no Git (git remote -v vazio). Cole a URL do origin
        (Azure/GitHub) para Push/Pull/Fetch.
      </p>
      <form
        className="flex gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (!url.trim()) return;
          void onAdd("origin", url.trim());
          setUrl("");
        }}
      >
        <input
          className="min-w-0 flex-1 rounded border border-[#2d3139] bg-[#171a20] px-1.5 py-1 text-[10px] outline-none focus:border-[#3d8bfd]"
          placeholder="https://… ou git@…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button
          type="submit"
          disabled={busy || !url.trim()}
          className="rounded bg-[#e3b341] px-1.5 py-1 text-[9px] font-semibold text-black disabled:opacity-40"
        >
          Add
        </button>
      </form>
    </div>
  );
}
