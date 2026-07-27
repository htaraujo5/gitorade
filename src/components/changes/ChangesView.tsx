import { useAppStore } from "../../stores/appStore";
import type { FileChange } from "../../lib/api";
import { ConflictBanner } from "../ConflictBanner";
import { DiffViewer } from "../diff/DiffViewer";

/** Three-column Changes layout: file list | diff | commit form. */
export function ChangesView() {
  const {
    status,
    selectedFile,
    diffText,
    lastCommit,
    stage,
    unstage,
    selectFile,
    commitMessage,
    setCommitMessage,
    commitOverrideProfileId,
    setCommitOverrideProfileId,
    profiles,
    repositories,
    activeRepoId,
    associateProfile,
    commit,
    busy,
  } = useAppStore();

  const repo = repositories.find((r) => r.id === activeRepoId);
  const activeProfile =
    profiles.find((p) => p.id === commitOverrideProfileId) ?? repo?.activeProfile ?? null;
  const stagedCount = status?.staged.length ?? 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <ConflictBanner />
      <div className="grid min-h-0 flex-1 gap-0 overflow-hidden rounded-[var(--radius-md)] border border-border lg:grid-cols-[240px_1fr_260px]">
        {/* File list */}
        <div className="flex min-h-0 flex-col border-b border-border bg-bg-secondary lg:border-b-0 lg:border-r">
          <div className="flex-1 space-y-3 overflow-auto p-3 text-sm">
            <FileGroup
              title="Staged"
              files={status?.staged ?? []}
              empty="Nenhum staged."
              actionLabel="Unstage"
              onAction={(paths) => void unstage(paths)}
              onSelect={(file) => void selectFile(file)}
              selected={selectedFile}
              disabled={busy || !repo}
            />
            <FileGroup
              title="Unstaged"
              files={status?.unstaged ?? []}
              empty={repo ? "Working tree limpa." : "Abra um repositório."}
              actionLabel="Stage"
              onAction={(paths) => void stage(paths)}
              onSelect={(file) => void selectFile(file)}
              selected={selectedFile}
              disabled={busy || !repo}
            />
          </div>
        </div>

        {/* Diff */}
        <div className="flex min-h-0 min-w-0 flex-col border-b border-border lg:border-b-0 lg:border-r">
          <DiffViewer
            selectedFile={selectedFile}
            diffText={diffText}
            stagedCount={stagedCount}
            unstagedCount={status?.unstaged.length ?? 0}
            lastCommitLabel={lastCommit ? `${lastCommit.hash} · ${lastCommit.authorName}` : null}
          />
        </div>

        {/* Commit form */}
        <div className="flex min-h-0 flex-col bg-bg-secondary p-3">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="text-text-muted">Identidade</span>
            {activeProfile && (
              <span className="rounded-full bg-success/20 px-2 py-0.5 text-success">Active</span>
            )}
          </div>
          <select
            className="mb-2 w-full rounded-[var(--radius-sm)] border border-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-primary"
            value={commitOverrideProfileId ?? ""}
            disabled={!repo || profiles.length === 0}
            onChange={(e) => {
              const value = e.target.value || null;
              setCommitOverrideProfileId(value);
              void associateProfile(value);
            }}
          >
            <option value="">Selecionar perfil…</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} &lt;{p.email}&gt;
              </option>
            ))}
          </select>
          <div className="mb-3 truncate text-xs text-text-muted">
            {activeProfile
              ? `${activeProfile.name} · ${activeProfile.email}`
              : "Nenhum perfil configurado"}
          </div>
          <label className="mb-1 text-[10px] uppercase tracking-wide text-text-muted">
            Mensagem
          </label>
          <textarea
            className="mb-2 h-24 w-full resize-none rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-50"
            placeholder="feat: …"
            value={commitMessage}
            disabled={!repo || busy}
            onChange={(e) => setCommitMessage(e.target.value)}
          />
          <button
            type="button"
            disabled={!repo || busy || !commitMessage.trim() || !activeProfile}
            onClick={() => void commit()}
            className="brand-gradient mt-auto w-full rounded-[var(--radius-sm)] px-3 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-40"
          >
            Commit ({stagedCount} {stagedCount === 1 ? "arquivo" : "arquivos"})
          </button>
        </div>
      </div>
    </div>
  );
}

function FileGroup({
  title,
  files,
  empty,
  actionLabel,
  onAction,
  onSelect,
  selected,
  disabled,
}: {
  title: string;
  files: FileChange[];
  empty: string;
  actionLabel: string;
  onAction: (paths: string[]) => void;
  onSelect: (file: FileChange) => void;
  selected: { path: string; staged: boolean } | null;
  disabled: boolean;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-medium uppercase tracking-wide text-text-muted">
          {title} ({files.length})
        </div>
        {files.length > 0 && (
          <button
            type="button"
            disabled={disabled}
            className="text-xs text-primary hover:underline disabled:opacity-40"
            onClick={() => onAction(files.map((f) => f.path))}
          >
            {actionLabel} all
          </button>
        )}
      </div>
      {files.length === 0 ? (
        <div className="rounded-[var(--radius-sm)] border border-dashed border-border px-3 py-3 text-xs text-text-muted">
          {empty}
        </div>
      ) : (
        <ul className="space-y-0.5">
          {files.map((file) => {
            const isSelected = selected?.path === file.path && selected.staged === file.staged;
            return (
              <li
                key={`${file.staged}-${file.path}`}
                className={`flex items-center gap-1 rounded-[var(--radius-sm)] ${
                  isSelected ? "bg-surface" : "hover:bg-surface/60"
                }`}
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate px-2 py-1.5 text-left text-xs"
                  onClick={() => onSelect(file)}
                  title={file.path}
                >
                  <StatusDot status={file.status} /> {file.path}
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  className="shrink-0 px-2 text-[11px] text-primary disabled:opacity-40"
                  onClick={() => onAction([file.path])}
                >
                  {actionLabel}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === "added" || status === "untracked"
      ? "text-success"
      : status === "deleted"
        ? "text-danger"
        : "text-warning";
  return <span className={`${color} font-mono uppercase`}>{status[0] ?? "M"}</span>;
}
