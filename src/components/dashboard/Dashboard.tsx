import { useMemo, useState, type ReactNode } from "react";
import { useAppStore } from "../../stores/appStore";
import logo from "../../assets/brand/logo.png";
import { IconRepos, IconPlus, IconStar } from "../Icons";

/** Start page — brand-forward, dense repo picker (no profile duplication). */
export function Dashboard() {
  const {
    repositories,
    selectRepository,
    openRepositoryDialog,
    initRepositoryDialog,
    cloneRepository,
    toggleFavorite,
    removeRepository,
    health,
    bootLoading,
    bootError,
    busy,
  } = useAppStore();

  const [query, setQuery] = useState("");
  const [cloneOpen, setCloneOpen] = useState(false);
  const [cloneUrl, setCloneUrl] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return repositories;
    return repositories.filter(
      (r) => r.name.toLowerCase().includes(q) || r.path.toLowerCase().includes(q),
    );
  }, [repositories, query]);

  const favorites = filtered.filter((r) => r.isFavorite);
  const recent = [...filtered]
    .sort((a, b) => {
      const ta = a.lastOpenedAt ? Date.parse(a.lastOpenedAt) : 0;
      const tb = b.lastOpenedAt ? Date.parse(b.lastOpenedAt) : 0;
      return tb - ta;
    })
    .slice(0, 12);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto bg-[#171a20]">
      {/* Brand hero — one composition */}
      <div className="relative shrink-0 overflow-hidden border-b border-[#2d3139] px-8 pb-7 pt-8">
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background:
              "radial-gradient(ellipse 70% 80% at 12% 40%, rgba(107,92,255,0.22), transparent 55%), radial-gradient(ellipse 50% 60% at 85% 20%, rgba(224,64,160,0.12), transparent 50%)",
          }}
        />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="flex min-w-0 items-center gap-5">
            <img
              src={logo}
              alt=""
              className="h-[72px] w-[72px] shrink-0 object-contain drop-shadow-[0_8px_28px_rgba(107,92,255,0.4)]"
              aria-hidden
            />
            <div className="min-w-0">
              <div className="text-[28px] font-semibold tracking-tight text-[#f0f1f4]">
                gitorade
              </div>
              <p className="mt-1 max-w-md text-[13px] text-[#8b909a]">
                Seu Git. Seu fluxo. Seu jeito. Abra um repositório e continue.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ActionBtn disabled={busy} onClick={() => setCloneOpen((v) => !v)} secondary>
              Clonar
            </ActionBtn>
            <ActionBtn disabled={busy} onClick={() => void initRepositoryDialog()} secondary>
              Novo
            </ActionBtn>
            <ActionBtn disabled={busy} onClick={() => void openRepositoryDialog()} primary>
              <IconRepos className="h-3.5 w-3.5" />
              Abrir
            </ActionBtn>
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-8 py-6">
        {(bootLoading || bootError || (health && !health.git.available)) && (
          <div className="rounded border border-[#2d3139] bg-[#1c1f26] px-4 py-3 text-[12px]">
            {bootLoading && <p className="text-[#8b909a]">Verificando ambiente…</p>}
            {bootError && <p className="text-[#f85149]">{bootError}</p>}
            {health && !health.git.available && (
              <p className="text-[#e3b341]">{health.git.message}</p>
            )}
          </div>
        )}

        {cloneOpen && (
          <form
            className="flex flex-wrap gap-2 rounded border border-[#2d3139] bg-[#1c1f26] p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void cloneRepository(cloneUrl);
              setCloneUrl("");
              setCloneOpen(false);
            }}
          >
            <input
              className="min-w-[240px] flex-1 rounded border border-[#2d3139] bg-[#12141a] px-3 py-2 text-[12px] outline-none focus:border-[#3d8bfd]"
              placeholder="URL do remote (https / ssh)"
              value={cloneUrl}
              onChange={(e) => setCloneUrl(e.target.value)}
              required
              autoFocus
            />
            <button
              type="submit"
              disabled={busy || !cloneUrl.trim()}
              className="rounded bg-gradient-to-r from-[#6b5cff] to-[#e040a0] px-4 py-2 text-[12px] font-medium text-white disabled:opacity-40"
            >
              Escolher pasta e clonar
            </button>
          </form>
        )}

        <div className="relative">
          <input
            className="w-full rounded border border-[#2d3139] bg-[#1c1f26] py-2.5 pl-3 pr-10 text-[13px] outline-none placeholder:text-[#5c6370] focus:border-[#3d8bfd]"
            placeholder="Filtrar repositórios…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Filtrar repositórios"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-[#2d3139] px-1.5 py-0.5 text-[10px] text-[#5c6370]">
            Ctrl+P
          </kbd>
        </div>

        {favorites.length > 0 && (
          <section>
            <SectionTitle icon={<IconStar className="h-3 w-3 text-[#e3b341]" />}>
              Favoritos
            </SectionTitle>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {favorites.map((repo) => (
                <button
                  key={repo.id}
                  type="button"
                  onClick={() => void selectRepository(repo.id)}
                  className="rounded border border-[#2d3139] bg-[#1c1f26] px-3 py-3 text-left transition hover:border-[#3d8bfd]/50 hover:bg-[#22262f]"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[#e3b341]" aria-hidden>
                      ★
                    </span>
                    <span className="truncate text-[13px] font-medium text-[#e8eaed]">
                      {repo.name}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-[11px] text-[#5c6370]" title={repo.path}>
                    {repo.path}
                  </div>
                  <div className="mt-2 font-mono text-[11px] text-[#3dd68c]">
                    {repo.branch ?? "—"}
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="min-h-0 flex-1">
          <SectionTitle icon={<IconRepos className="h-3 w-3" />}>
            Repositórios recentes
          </SectionTitle>
          {recent.length === 0 ? (
            <EmptyState
              busy={busy}
              onOpen={() => void openRepositoryDialog()}
              onClone={() => setCloneOpen(true)}
            />
          ) : (
            <ul className="overflow-hidden rounded border border-[#2d3139] bg-[#1c1f26]">
              {recent.map((repo, i) => (
                <li
                  key={repo.id}
                  className={`group flex items-center gap-3 px-3 py-2.5 ${
                    i > 0 ? "border-t border-[#2d3139]/80" : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => void selectRepository(repo.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#252830] text-[11px] font-semibold text-[#a371f7]">
                      {repo.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-[#e8eaed]">{repo.name}</span>
                      <span className="block truncate text-[11px] text-[#5c6370]">{repo.path}</span>
                    </span>
                  </button>
                  <span className="hidden shrink-0 font-mono text-[11px] text-[#3dd68c] sm:inline">
                    {repo.branch ?? "—"}
                  </span>
                  <span className="hidden w-14 shrink-0 text-right text-[11px] text-[#5c6370] md:inline">
                    {relative(repo.lastOpenedAt)}
                  </span>
                  <button
                    type="button"
                    className="px-1 text-[12px] text-[#5c6370] opacity-0 hover:text-[#e3b341] group-hover:opacity-100"
                    aria-label={repo.isFavorite ? "Remover favorito" : "Favoritar"}
                    onClick={() => void toggleFavorite(repo.id)}
                  >
                    {repo.isFavorite ? "★" : "☆"}
                  </button>
                  <button
                    type="button"
                    className="px-1 text-[12px] text-[#5c6370] opacity-0 hover:text-[#f85149] group-hover:opacity-100"
                    aria-label={`Remover ${repo.name}`}
                    onClick={() => void removeRepository(repo.id)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function EmptyState({
  busy,
  onOpen,
  onClone,
}: {
  busy: boolean;
  onOpen: () => void;
  onClone: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded border border-dashed border-[#2d3139] px-6 py-14 text-center">
      <IconPlus className="mb-3 h-8 w-8 text-[#3a3f4b]" />
      <p className="text-[13px] text-[#c8ccd4]">Nenhum repositório ainda</p>
      <p className="mt-1 max-w-sm text-[12px] text-[#6b7280]">
        Abra uma pasta local, clone um remote ou inicialize um novo Git.
      </p>
      <div className="mt-4 flex gap-2">
        <ActionBtn disabled={busy} onClick={onOpen} primary>
          Abrir pasta
        </ActionBtn>
        <ActionBtn disabled={busy} onClick={onClone} secondary>
          Clonar URL
        </ActionBtn>
      </div>
    </div>
  );
}

function SectionTitle({ children, icon }: { children: ReactNode; icon: ReactNode }) {
  return (
    <h2 className="mb-2.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-[#6b7280]">
      {icon}
      {children}
    </h2>
  );
}

function ActionBtn({
  children,
  onClick,
  disabled,
  primary,
  secondary,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  secondary?: boolean;
}) {
  const base =
    "inline-flex items-center gap-1.5 rounded px-3.5 py-2 text-[12px] font-medium transition disabled:opacity-40";
  if (primary) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={`${base} bg-gradient-to-r from-[#6b5cff] to-[#e040a0] text-white hover:brightness-110`}
      >
        {children}
      </button>
    );
  }
  if (secondary) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={`${base} border border-[#2d3139] bg-[#1c1f26] text-[#c8ccd4] hover:bg-[#252830]`}
      >
        {children}
      </button>
    );
  }
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={base}>
      {children}
    </button>
  );
}

function relative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
