import { useAppStore } from "../../stores/appStore";

export function Header() {
  const {
    repositories,
    activeRepoId,
    status,
    remotes,
    operation,
    setWorkspaceTab,
    setRightTab,
    refreshStatus,
    fetch,
    pull,
    push,
    busy,
  } = useAppStore();
  const repo = repositories.find((r) => r.id === activeRepoId);
  const branch = status?.branch ?? repo?.branch ?? "—";
  const hasRemote = remotes.length > 0;
  const opRunning = Boolean(operation && !operation.done);
  const disabled = !repo || busy || opRunning;

  return (
    <header className="flex h-12 items-center justify-between gap-3 border-b border-border bg-bg-secondary px-4">
      <div className="flex min-w-0 items-center gap-3 text-sm">
        <span className="truncate font-medium">{repo?.name ?? "Nenhum repositório"}</span>
        {repo && (
          <span className="shrink-0 rounded-full bg-branch-current/15 px-2 py-0.5 text-xs text-branch-current">
            {branch}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Action
          label="Commit"
          disabled={disabled}
          onClick={() => {
            setWorkspaceTab("changes");
            setRightTab("changes");
          }}
        />
        <Action
          label="Pull"
          disabled={disabled || !hasRemote}
          title={hasRemote ? "Pull" : "Configure um remote"}
          onClick={() => void pull()}
        />
        <Action
          label="Push"
          disabled={disabled || !hasRemote}
          title={hasRemote ? "Push" : "Configure um remote"}
          onClick={() => void push()}
        />
        <Action
          label="Fetch"
          disabled={disabled || !hasRemote}
          title={hasRemote ? "Fetch" : "Configure um remote"}
          onClick={() => void fetch()}
        />
        <Action label="Branch" disabled title="Branch (em breve)" onClick={() => {}} soon />
        <Action label="Merge" disabled title="Merge (em breve)" onClick={() => {}} soon />
        <Action label="Stash" disabled title="Stash (em breve)" onClick={() => {}} soon />
        <button
          type="button"
          disabled={disabled}
          onClick={() => void refreshStatus()}
          className="ml-1 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-xs text-text-muted transition hover:bg-surface hover:text-text disabled:opacity-40"
        >
          Refresh
        </button>
      </div>
    </header>
  );
}

function Action({
  label,
  disabled,
  onClick,
  title,
  soon,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  title?: string;
  soon?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title ?? label}
      className={`rounded-[var(--radius-sm)] px-2.5 py-1.5 text-xs transition hover:bg-surface hover:text-text disabled:cursor-not-allowed disabled:opacity-40 ${
        soon ? "text-text-muted/60" : "text-text-muted"
      }`}
    >
      {label}
    </button>
  );
}
