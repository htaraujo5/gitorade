import { useMemo, useState } from "react";
import { useAppStore } from "../../stores/appStore";
import type { FileChange } from "../../lib/api";

type ViewMode = "path" | "tree";

/**
 * Commit panel like GitKraken:
 * - no identity dropdown here (profile menu in header)
 * - dense file rows, icons sized to text
 * - summary + description + primary action
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
    busy,
    remotes,
    addRemote,
    repositories,
    activeRepoId,
    profiles,
    commitOverrideProfileId,
  } = useAppStore();

  const [description, setDescription] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("path");
  const [amend, setAmend] = useState(false);

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

  const primaryDisabled =
    !repo ||
    busy ||
    !activeProfile ||
    (staged.length > 0 && !commitMessage.trim()) ||
    (staged.length === 0 && unstaged.length === 0);

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

      <div className="space-y-1.5 border-t border-[#2d3139] bg-[#171a20] p-2.5">
        <label className="flex items-center gap-1.5 text-[10px] text-[#8b909a]">
          <input
            type="checkbox"
            checked={amend}
            onChange={(e) => setAmend(e.target.checked)}
            className="h-3 w-3 rounded border-[#2d3139]"
          />
          Amend previous commit
        </label>

        <div className="relative">
          <input
            className="h-8 w-full rounded border border-[#2d3139] bg-[#1c1f26] px-2 pr-8 text-[12px] text-[#e8eaed] outline-none placeholder:text-[#5c6370] focus:border-[#3d8bfd]"
            placeholder="Summary"
            value={commitMessage}
            disabled={!repo || busy}
            maxLength={200}
            onChange={(e) => setCommitMessage(e.target.value)}
          />
          <span
            className={`pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] tabular-nums ${
              summaryLen > 72 ? "text-[#e3b341]" : "text-[#5c6370]"
            }`}
          >
            {Math.max(0, 72 - summaryLen)}
          </span>
        </div>

        <textarea
          className="h-14 w-full resize-none rounded border border-[#2d3139] bg-[#1c1f26] px-2 py-1.5 text-[11px] text-[#e8eaed] outline-none placeholder:text-[#5c6370] focus:border-[#3d8bfd]"
          placeholder="Description"
          value={description}
          disabled={!repo || busy}
          onChange={(e) => setDescription(e.target.value)}
        />

        <button
          type="button"
          disabled={primaryDisabled}
          onClick={() => {
            if (staged.length === 0) {
              void stage(unstaged.map((f) => f.path));
              return;
            }
            const summary = commitMessage.trim();
            const body = description.trim();
            if (body) setCommitMessage(`${summary}\n\n${body}`);
            setDescription("");
            void commit();
          }}
          className="w-full rounded bg-[#238636] py-2 text-[12px] font-medium text-white hover:bg-[#2ea043] disabled:cursor-not-allowed disabled:opacity-35"
        >
          {staged.length === 0
            ? "Stage Changes to Commit"
            : `Commit changes to ${status?.branch ?? "HEAD"}`}
        </button>

        {!activeProfile && (
          <p className="text-[10px] text-[#e3b341]">
            Selecione um perfil no menu do canto superior direito.
          </p>
        )}
        {amend && (
          <p className="text-[10px] text-[#e3b341]">Amend em breve — cria commit novo por agora.</p>
        )}
      </div>
    </aside>
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
