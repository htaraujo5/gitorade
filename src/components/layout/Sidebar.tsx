import { useState, type ReactNode } from "react";
import { BrandMark } from "../BrandMark";
import { useAppStore } from "../../stores/appStore";

export function Sidebar() {
  const {
    repositories,
    activeRepoId,
    selectRepository,
    openRepositoryDialog,
    initRepositoryDialog,
    cloneRepository,
    toggleFavorite,
    removeRepository,
    setRightTab,
    busy,
  } = useAppStore();

  const [cloneOpen, setCloneOpen] = useState(false);
  const [cloneUrl, setCloneUrl] = useState("");
  const favorites = repositories.filter((r) => r.isFavorite);

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-bg-secondary">
      <div className="border-b border-border px-4 py-4">
        <BrandMark />
      </div>

      <div className="space-y-2 border-b border-border px-3 py-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void openRepositoryDialog()}
          className="brand-gradient w-full rounded-[var(--radius-sm)] px-3 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          Abrir repositório
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => setCloneOpen((v) => !v)}
            className="flex-1 rounded-[var(--radius-sm)] border border-border px-2 py-1.5 text-xs text-text-muted transition hover:bg-surface hover:text-text disabled:opacity-50"
          >
            Clonar
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void initRepositoryDialog()}
            className="flex-1 rounded-[var(--radius-sm)] border border-border px-2 py-1.5 text-xs text-text-muted transition hover:bg-surface hover:text-text disabled:opacity-50"
          >
            Init
          </button>
        </div>
        {cloneOpen && (
          <form
            className="space-y-2 rounded-[var(--radius-sm)] border border-border p-2"
            onSubmit={(e) => {
              e.preventDefault();
              void cloneRepository(cloneUrl);
              setCloneUrl("");
              setCloneOpen(false);
            }}
          >
            <input
              className="w-full rounded-[var(--radius-sm)] border border-border bg-bg px-2 py-1.5 text-xs outline-none focus:border-primary"
              placeholder="URL do repositório (https/ssh)"
              value={cloneUrl}
              onChange={(e) => setCloneUrl(e.target.value)}
              required
            />
            <button
              type="submit"
              disabled={busy || !cloneUrl.trim()}
              className="brand-gradient w-full rounded-[var(--radius-sm)] px-2 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              Escolher destino e clonar
            </button>
          </form>
        )}
      </div>

      <nav className="flex-1 overflow-auto px-3 py-4 text-sm">
        <Section title="Repositórios">
          {repositories.length === 0 ? (
            <p className="px-2 py-1 text-xs text-text-muted">Nenhum repositório aberto.</p>
          ) : (
            repositories.map((repo) => (
              <div
                key={repo.id}
                className={`group flex items-center gap-1 rounded-[var(--radius-sm)] ${
                  repo.id === activeRepoId ? "bg-surface" : "hover:bg-surface/60"
                }`}
              >
                <button
                  type="button"
                  onClick={() => void selectRepository(repo.id)}
                  className={`min-w-0 flex-1 truncate px-2 py-1.5 text-left ${
                    repo.id === activeRepoId ? "text-text" : "text-text-muted"
                  }`}
                  title={repo.path}
                >
                  {repo.name}
                </button>
                <button
                  type="button"
                  className="px-1 text-xs text-text-muted opacity-0 group-hover:opacity-100"
                  title={repo.isFavorite ? "Remover favorito" : "Favoritar"}
                  onClick={() => void toggleFavorite(repo.id)}
                >
                  {repo.isFavorite ? "★" : "☆"}
                </button>
                <button
                  type="button"
                  className="px-1 text-xs text-text-muted opacity-0 group-hover:opacity-100 hover:text-danger"
                  title="Remover da lista"
                  onClick={() => void removeRepository(repo.id)}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </Section>

        <Section title="Favoritos">
          {favorites.length === 0 ? (
            <p className="px-2 py-1 text-xs text-text-muted">Nenhum favorito ainda.</p>
          ) : (
            favorites.map((repo) => (
              <button
                key={repo.id}
                type="button"
                onClick={() => void selectRepository(repo.id)}
                className="flex w-full items-center rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-text-muted transition hover:bg-surface/60 hover:text-text"
              >
                <span className="truncate">{repo.name}</span>
              </button>
            ))
          )}
        </Section>

        <Section title="Configurações">
          <button
            type="button"
            onClick={() => setRightTab("credentials")}
            className="flex w-full items-center rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-text-muted transition hover:bg-surface/60 hover:text-text"
          >
            Credenciais
          </button>
          <span className="block px-2 py-1.5 text-text-muted/50">SSH Keys</span>
          <span className="block px-2 py-1.5 text-text-muted/50">Preferências</span>
          <span className="block px-2 py-1.5 text-text-muted/50">Plugins</span>
          <span className="block px-2 py-1.5 text-text-muted/50">About Gitorade</span>
        </Section>
      </nav>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-5">
      <div className="mb-2 px-2 text-[11px] font-medium uppercase tracking-wide text-text-muted">
        {title}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}
