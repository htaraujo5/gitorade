import { useAppStore } from "../../stores/appStore";

export { CredentialsPage } from "./CredentialsPage";

export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="max-w-md text-sm text-text-muted">{description}</p>
    </div>
  );
}

export function RepoListPage({ mode }: { mode: "all" | "favorites" }) {
  const {
    repositories,
    selectRepository,
    toggleFavorite,
    removeRepository,
    openRepositoryDialog,
    busy,
  } = useAppStore();
  const list = mode === "favorites" ? repositories.filter((r) => r.isFavorite) : repositories;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto bg-bg p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          {mode === "favorites" ? "Favoritos" : "Repositórios"}
        </h1>
        <button
          type="button"
          disabled={busy}
          onClick={() => void openRepositoryDialog()}
          className="brand-gradient rounded-[var(--radius-sm)] px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          Abrir
        </button>
      </div>
      {list.length === 0 ? (
        <p className="text-sm text-text-muted">Nenhum item nesta lista.</p>
      ) : (
        <ul className="divide-y divide-border rounded-[var(--radius-md)] border border-border bg-bg-secondary">
          {list.map((repo) => (
            <li key={repo.id} className="flex items-center gap-2 px-3 py-2.5">
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => void selectRepository(repo.id)}
              >
                <div className="truncate font-medium">{repo.name}</div>
                <div className="truncate text-[11px] text-text-muted">{repo.path}</div>
              </button>
              <button
                type="button"
                className="text-xs text-text-muted"
                onClick={() => void toggleFavorite(repo.id)}
              >
                {repo.isFavorite ? "★" : "☆"}
              </button>
              <button
                type="button"
                className="text-xs text-text-muted hover:text-danger"
                onClick={() => void removeRepository(repo.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
