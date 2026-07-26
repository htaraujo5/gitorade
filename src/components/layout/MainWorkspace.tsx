import { useAppStore } from "../../stores/appStore";
import { BrandMark } from "../BrandMark";

const tabs = [
  { id: "graph", label: "Graph", ready: false },
  { id: "commits", label: "Commits", ready: false },
  { id: "changes", label: "Changes", ready: true },
  { id: "files", label: "Files", ready: false },
] as const;

export function MainWorkspace() {
  const {
    health,
    bootLoading,
    bootError,
    workspaceTab,
    setWorkspaceTab,
    activeRepoId,
    repositories,
    selectedFile,
    diffText,
    status,
    lastCommit,
    notice,
    error,
    clearNotice,
  } = useAppStore();

  const repo = repositories.find((r) => r.id === activeRepoId);

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-bg">
      <div className="flex gap-1 border-b border-border px-3 pt-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            disabled={!tab.ready}
            onClick={() => setWorkspaceTab(tab.id)}
            className={`rounded-t-[var(--radius-sm)] px-3 py-2 text-sm transition ${
              workspaceTab === tab.id
                ? "border-b-2 border-primary text-text"
                : "border-b-2 border-transparent text-text-muted hover:text-text disabled:opacity-40"
            }`}
            title={tab.ready ? tab.label : `${tab.label} (em breve)`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {(notice || error) && (
        <div
          className={`flex items-center justify-between border-b px-4 py-2 text-xs ${
            error
              ? "border-danger/30 bg-danger/10 text-danger"
              : "border-success/30 bg-success/10 text-success"
          }`}
        >
          <span>{error ?? notice}</span>
          <button type="button" onClick={clearNotice} className="opacity-70 hover:opacity-100">
            Fechar
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-auto p-4">
        {!repo ? (
          <EmptyHome health={health} bootLoading={bootLoading} bootError={bootError} />
        ) : workspaceTab === "changes" ? (
          <DiffPane
            selectedFile={selectedFile}
            diffText={diffText}
            stagedCount={status?.staged.length ?? 0}
            unstagedCount={status?.unstaged.length ?? 0}
            lastCommit={lastCommit}
          />
        ) : (
          <div className="text-sm text-text-muted">Em breve.</div>
        )}
      </div>
    </section>
  );
}

function EmptyHome({
  health,
  bootLoading,
  bootError,
}: {
  health: ReturnType<typeof useAppStore.getState>["health"];
  bootLoading: boolean;
  bootError: string | null;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      <BrandMark lockup />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Seu Git. Seu fluxo. Seu jeito.</h1>
        <p className="mt-2 max-w-md text-sm text-text-muted">
          Abra um repositório local para revisar mudanças, escolher a identidade e commitar —
          sem alterar seu Git global.
        </p>
      </div>

      <div className="w-full max-w-md rounded-[var(--radius-md)] border border-border bg-bg-secondary p-4 text-left text-sm">
        <div className="mb-3 text-xs font-medium uppercase tracking-wide text-text-muted">
          Health check
        </div>
        {bootLoading && <p className="text-text-muted">Verificando…</p>}
        {bootError && <p className="text-danger">{bootError}</p>}
        {health && (
          <dl className="space-y-2">
            <Row label="App" value={`v${health.appVersion}`} />
            <Row
              label="Git"
              value={health.git.available ? (health.git.version ?? "ok") : health.git.message}
              ok={health.git.available}
            />
            <Row
              label="Database"
              value={health.databaseReady ? "SQLite pronto" : "indisponível"}
              ok={health.databaseReady}
            />
          </dl>
        )}
      </div>
    </div>
  );
}

function DiffPane({
  selectedFile,
  diffText,
  stagedCount,
  unstagedCount,
  lastCommit,
}: {
  selectedFile: { path: string; staged: boolean } | null;
  diffText: string;
  stagedCount: number;
  unstagedCount: number;
  lastCommit: ReturnType<typeof useAppStore.getState>["lastCommit"];
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted">
        <div>
          {stagedCount} staged · {unstagedCount} unstaged
          {lastCommit && (
            <span className="ml-2 text-success">
              último: {lastCommit.hash} · {lastCommit.authorName}
            </span>
          )}
        </div>
        {selectedFile && (
          <div className="font-mono text-text">
            {selectedFile.staged ? "staged" : "unstaged"} · {selectedFile.path}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-[var(--radius-md)] border border-border bg-bg-secondary">
        {!selectedFile ? (
          <div className="p-6 text-sm text-text-muted">
            Selecione um arquivo no painel Changes para ver o diff.
          </div>
        ) : diffText.trim() === "" ? (
          <div className="p-6 text-sm text-text-muted">
            Sem diff textual (arquivo binário, novo sem conteúdo comparado, ou sem mudanças).
          </div>
        ) : (
          <pre className="p-4 font-mono text-[12px] leading-5">
            {diffText.split("\n").map((line, i) => (
              <div
                key={`${i}-${line.slice(0, 24)}`}
                className={
                  line.startsWith("+") && !line.startsWith("+++")
                    ? "bg-success/10 text-success"
                    : line.startsWith("-") && !line.startsWith("---")
                      ? "bg-danger/10 text-danger"
                      : line.startsWith("@@")
                        ? "text-accent"
                        : "text-text-muted"
                }
              >
                {line || " "}
              </div>
            ))}
          </pre>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-text-muted">{label}</dt>
      <dd
        className={`text-right ${
          ok === undefined ? "" : ok ? "text-success" : "text-danger"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
