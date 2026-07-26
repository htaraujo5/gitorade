import { useEffect, useState } from "react";
import { useAppStore } from "../../stores/appStore";
import type { Profile } from "../../lib/api";

/** Profile / credentials manager — denser GitKraken-like layout. */
export function CredentialsPage() {
  const {
    profiles,
    repositories,
    activeRepoId,
    createProfile,
    deleteProfile,
    associateProfile,
    busy,
    openSshTab,
  } = useAppStore();

  const repo = repositories.find((r) => r.id === activeRepoId);
  const [selectedId, setSelectedId] = useState<string | null>(
    profiles[0]?.id ?? null,
  );
  const selected = profiles.find((p) => p.id === selectedId) ?? null;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [provider, setProvider] = useState("GitHub");
  const [creating, setCreating] = useState(profiles.length === 0);

  useEffect(() => {
    if (!selectedId && profiles[0]) setSelectedId(profiles[0].id);
  }, [profiles, selectedId]);

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-[#171a20]">
      <aside className="flex w-[280px] shrink-0 flex-col border-r border-[#2d3139] bg-[#1c1f26]">
        <div className="flex items-center justify-between border-b border-[#2d3139] px-3 py-2.5">
          <div>
            <div className="text-[12px] font-medium text-[#e8eaed]">Perfis</div>
            <div className="text-[10px] text-[#6b7280]">
              {profiles.length} identidade{profiles.length === 1 ? "" : "s"}
            </div>
          </div>
          <button
            type="button"
            className="rounded border border-[#2d3139] px-2 py-1 text-[10px] text-[#c8ccd4] hover:bg-[#252830]"
            onClick={() => setCreating((v) => !v)}
          >
            {creating ? "Cancelar" : "+ Novo"}
          </button>
        </div>

        <ul className="min-h-0 flex-1 space-y-1 overflow-auto p-2">
          {profiles.length === 0 ? (
            <li className="px-2 py-6 text-center text-[11px] text-[#6b7280]">
              Nenhum perfil ainda.
            </li>
          ) : (
            profiles.map((p) => (
              <li key={p.id}>
                <ProfileRow
                  profile={p}
                  active={p.id === (repo?.defaultProfileId ?? null)}
                  selected={p.id === selectedId}
                  onSelect={() => {
                    setSelectedId(p.id);
                    setCreating(false);
                  }}
                />
              </li>
            ))
          )}
        </ul>

        {creating && (
          <form
            className="space-y-2 border-t border-[#2d3139] p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void (async () => {
                try {
                  await createProfile({ name, email, provider });
                  setName("");
                  setEmail("");
                  setCreating(false);
                } catch {
                  /* erro já no store */
                }
              })();
            }}
          >
            <div className="text-[9px] font-medium uppercase tracking-[0.08em] text-[#6b7280]">
              Novo perfil
            </div>
            <input
              className="w-full rounded border border-[#2d3139] bg-[#12141a] px-2.5 py-1.5 text-[12px] outline-none focus:border-[#3d8bfd]"
              placeholder="Nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
            <input
              className="w-full rounded border border-[#2d3139] bg-[#12141a] px-2.5 py-1.5 text-[12px] outline-none focus:border-[#3d8bfd]"
              placeholder="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <select
              className="w-full rounded border border-[#2d3139] bg-[#12141a] px-2.5 py-1.5 text-[12px] outline-none focus:border-[#3d8bfd]"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              <option>GitHub</option>
              <option>GitLab</option>
              <option>Bitbucket</option>
              <option>Outro</option>
            </select>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded bg-gradient-to-r from-[#6b5cff] to-[#e040a0] py-2 text-[12px] font-medium text-white disabled:opacity-40"
            >
              Criar perfil
            </button>
          </form>
        )}
      </aside>

      <div className="min-h-0 min-w-0 flex-1 overflow-auto p-6">
        {!selected ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="text-[13px] text-[#c8ccd4]">Nenhum perfil selecionado</p>
            <p className="mt-1 text-[12px] text-[#6b7280]">
              Crie uma identidade para assinar commits por repositório.
            </p>
            <button
              type="button"
              className="mt-4 rounded bg-gradient-to-r from-[#6b5cff] to-[#e040a0] px-4 py-2 text-[12px] text-white"
              onClick={() => setCreating(true)}
            >
              Criar primeiro perfil
            </button>
          </div>
        ) : (
          <div className="mx-auto max-w-xl">
            <div className="mb-5 flex items-start gap-4">
              <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#6b5cff] to-[#e040a0] text-xl font-semibold text-white">
                {selected.name.trim().slice(0, 1).toUpperCase() || "?"}
              </span>
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-[20px] font-medium tracking-tight text-[#f0f1f4]">
                  {selected.name}
                </h1>
                <p className="mt-0.5 truncate text-[13px] text-[#8b909a]">{selected.email}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {selected.provider && (
                    <span className="rounded bg-[#252830] px-2 py-0.5 text-[10px] text-[#a8adb8]">
                      {selected.provider}
                    </span>
                  )}
                  {selected.id === repo?.defaultProfileId && (
                    <span className="rounded bg-[#238636]/20 px-2 py-0.5 text-[10px] text-[#3dd68c]">
                      Ativo no repo
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2 rounded border border-[#2d3139] bg-[#1c1f26] p-4">
              <Detail label="Email" value={selected.email} />
              <Detail label="Provider" value={selected.provider ?? "—"} />
              <Detail
                label="Chave SSH"
                value={
                  selected.sshKeyPath ??
                  "Não configurada — use o agente SSH do sistema"
                }
              />
              {repo && (
                <Detail
                  label="Repo atual"
                  value={`${repo.name}${
                    selected.id === repo.defaultProfileId ? " · associado" : ""
                  }`}
                />
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!repo || busy || selected.id === repo?.defaultProfileId}
                className="rounded bg-gradient-to-r from-[#6b5cff] to-[#e040a0] px-3.5 py-2 text-[12px] font-medium text-white disabled:opacity-40"
                onClick={() => void associateProfile(selected.id)}
              >
                Usar no repo ativo
              </button>
              <button
                type="button"
                className="rounded border border-[#2d3139] px-3.5 py-2 text-[12px] text-[#c8ccd4] hover:bg-[#252830]"
                onClick={() => openSshTab()}
              >
                Configurar SSH
              </button>
              <button
                type="button"
                disabled={busy}
                className="rounded border border-[#f85149]/35 px-3.5 py-2 text-[12px] text-[#f85149] hover:bg-[#f85149]/10 disabled:opacity-40"
                onClick={() => {
                  if (window.confirm(`Remover perfil ${selected.name}?`)) {
                    void deleteProfile(selected.id);
                    setSelectedId(null);
                  }
                }}
              >
                Remover
              </button>
            </div>

            <p className="mt-6 text-[11px] leading-relaxed text-[#5c6370]">
              Cada repositório pode usar um perfil diferente (nome/email/SSH). O
              seletor no canto superior direito define a assinatura do próximo
              commit.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ProfileRow({
  profile,
  active,
  selected,
  onSelect,
}: {
  profile: Profile;
  active: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const letter = profile.name.trim().slice(0, 1).toUpperCase() || "?";
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition ${
        selected
          ? "bg-[#1e3a5f] ring-1 ring-[#3d8bfd]/40"
          : "hover:bg-[#252830]"
      }`}
    >
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-[#6b5cff] to-[#e040a0] text-[11px] font-semibold text-white">
        {letter}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[12px] text-[#e8eaed]">{profile.name}</span>
          {active && (
            <span className="shrink-0 rounded bg-[#238636]/25 px-1 text-[9px] text-[#3dd68c]">
              ativo
            </span>
          )}
        </span>
        <span className="block truncate text-[10px] text-[#6b7280]">{profile.email}</span>
      </span>
    </button>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#2d3139]/70 py-2 last:border-0">
      <dt className="shrink-0 text-[10px] uppercase tracking-wide text-[#6b7280]">
        {label}
      </dt>
      <dd className="min-w-0 text-right text-[12px] text-[#d8dbe2] break-all">{value}</dd>
    </div>
  );
}
