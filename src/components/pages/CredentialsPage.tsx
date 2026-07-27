import { useEffect, useRef, useState, type FormEvent } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useAppStore } from "../../stores/appStore";
import type { Profile } from "../../lib/api";
import { fileToAvatarDataUrl } from "../../lib/avatarImage";
import { requireDangerousConfirm } from "../../lib/dangerousConfirm";
import { IconCredentials, IconKey, IconPlus } from "../Icons";
import { UserAvatar } from "../UserAvatar";

type Mode = "view" | "create" | "edit";

/**
 * Credentials — GitKraken/Fork style:
 * left list only · create/edit form lives in the main panel (never jammed in the sidebar).
 */
export function CredentialsPage() {
  const {
    profiles,
    repositories,
    activeRepoId,
    createProfile,
    updateProfile,
    deleteProfile,
    associateProfile,
    busy,
    openSshTab,
  } = useAppStore();

  const repo = repositories.find((r) => r.id === activeRepoId);
  const [selectedId, setSelectedId] = useState<string | null>(profiles[0]?.id ?? null);
  const selected = profiles.find((p) => p.id === selectedId) ?? null;
  const [mode, setMode] = useState<Mode>(profiles.length === 0 ? "create" : "view");
  const [formError, setFormError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [provider, setProvider] = useState("Local");
  const [avatarData, setAvatarData] = useState<string | null>(null);

  useEffect(() => {
    if (profiles.length === 0) {
      setMode("create");
      setSelectedId(null);
      return;
    }
    if (!selectedId || !profiles.some((p) => p.id === selectedId)) {
      setSelectedId(profiles[0].id);
      if (mode !== "create") setMode("view");
    }
  }, [profiles, selectedId, mode]);

  const startCreate = () => {
    setName("");
    setEmail("");
    setProvider("Local");
    setAvatarData(null);
    setFormError(null);
    setMode("create");
  };

  const startEdit = (p: Profile) => {
    setSelectedId(p.id);
    setName(p.name);
    setEmail(p.email);
    setProvider(p.provider ?? "Local");
    setAvatarData(p.avatarData ?? null);
    setFormError(null);
    setMode("edit");
  };

  const cancelForm = () => {
    setFormError(null);
    if (profiles.length === 0) {
      setMode("create");
      return;
    }
    setMode("view");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!name.trim() || !email.trim()) {
      setFormError("Informe nome e email.");
      return;
    }
    try {
      if (mode === "edit" && selectedId) {
        await updateProfile({
          id: selectedId,
          name: name.trim(),
          email: email.trim(),
          provider,
          sshKeyPath: selected?.sshKeyPath ?? null,
          avatarData,
        });
        setMode("view");
      } else {
        const created = await createProfile(
          {
            name: name.trim(),
            email: email.trim(),
            provider,
            avatarData,
          },
          { stay: true },
        );
        setSelectedId(created.id);
        setName("");
        setEmail("");
        setAvatarData(null);
        setMode("view");
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    }
  };

  const showForm = mode === "create" || mode === "edit";

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-[#171a20]">
      <aside className="flex w-[260px] shrink-0 flex-col border-r border-[#2d3139] bg-[#1c1f26]">
        <div className="flex items-center justify-between gap-2 border-b border-[#2d3139] px-3 py-2.5">
          <div className="min-w-0">
            <div className="text-[12px] font-medium text-[#e8eaed]">Identidades</div>
            <div className="text-[10px] text-[#6b7280]">
              {profiles.length === 0
                ? "Nenhuma ainda"
                : `${profiles.length} perfil${profiles.length === 1 ? "" : "es"}`}
            </div>
          </div>
          <button
            type="button"
            title="Nova identidade"
            className="inline-flex h-7 items-center gap-1 rounded border border-[#2d3139] px-2 text-[11px] text-[#c8ccd4] hover:bg-[#252830] hover:text-[#e8eaed]"
            onClick={startCreate}
          >
            <IconPlus className="h-3 w-3" />
            Novo
          </button>
        </div>

        <ul className="min-h-0 flex-1 space-y-0.5 overflow-auto p-2">
          {profiles.length === 0 ? (
            <li className="px-2 py-8 text-center text-[11px] leading-relaxed text-[#5c6370]">
              Crie sua primeira identidade no painel ao lado.
            </li>
          ) : (
            profiles.map((p) => (
              <li key={p.id}>
                <ProfileRow
                  profile={p}
                  active={p.id === (repo?.defaultProfileId ?? null)}
                  selected={p.id === selectedId && mode === "view"}
                  onSelect={() => {
                    setSelectedId(p.id);
                    setMode("view");
                    setFormError(null);
                  }}
                />
              </li>
            ))
          )}
        </ul>
      </aside>

      <div className="min-h-0 min-w-0 flex-1 overflow-auto">
        {showForm ? (
          <ProfileForm
            title={mode === "edit" ? "Editar identidade" : "Nova identidade"}
            subtitle={
              mode === "edit"
                ? "Atualize nome, email, foto e provedor usados nos commits."
                : "Essa identidade assina commits. Você pode criar várias (trabalho, pessoal…)."
            }
            name={name}
            email={email}
            provider={provider}
            avatarData={avatarData}
            error={formError}
            busy={busy}
            submitLabel={mode === "edit" ? "Salvar" : "Criar identidade"}
            showCancel={profiles.length > 0 || mode === "edit"}
            onName={setName}
            onEmail={setEmail}
            onProvider={setProvider}
            onAvatarData={setAvatarData}
            onCancel={cancelForm}
            onSubmit={(e) => void submit(e)}
          />
        ) : selected ? (
          <ProfileDetail
            profile={selected}
            repoName={repo?.name ?? null}
            isRepoDefault={selected.id === repo?.defaultProfileId}
            canAssociate={Boolean(repo)}
            busy={busy}
            onEdit={() => startEdit(selected)}
            onAssociate={() => void associateProfile(selected.id)}
            onSsh={() => openSshTab()}
            onDelete={() => {
              if (!requireDangerousConfirm(`Remover identidade "${selected.name}"?`)) return;
              void deleteProfile(selected.id).then(() => {
                setSelectedId(null);
              });
            }}
          />
        ) : (
          <EmptyHint onCreate={startCreate} />
        )}
      </div>
    </div>
  );
}

function ProfileForm({
  title,
  subtitle,
  name,
  email,
  provider,
  avatarData,
  error,
  busy,
  submitLabel,
  showCancel,
  onName,
  onEmail,
  onProvider,
  onAvatarData,
  onCancel,
  onSubmit,
}: {
  title: string;
  subtitle: string;
  name: string;
  email: string;
  provider: string;
  avatarData: string | null;
  error: string | null;
  busy: boolean;
  submitLabel: string;
  showCancel: boolean;
  onName: (v: string) => void;
  onEmail: (v: string) => void;
  onProvider: (v: string) => void;
  onAvatarData: (v: string | null) => void;
  onCancel: () => void;
  onSubmit: (e: FormEvent) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const onPickFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      onAvatarData(await fileToAvatarDataUrl(file));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="flex min-h-full items-start justify-center px-8 py-10">
      <form className="w-full max-w-md" onSubmit={onSubmit}>
        <div className="mb-6 flex items-start gap-3">
          <UserAvatar
            key={`${email}-${avatarData ? "custom" : "g"}`}
            name={name || "?"}
            email={email}
            src={avatarData}
            size={64}
            rounded="xl"
            gradientFallback
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-[18px] font-semibold tracking-tight text-[#f0f1f4]">{title}</h1>
            <p className="mt-1 text-[12px] leading-relaxed text-[#8b909a]">{subtitle}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded border border-[#3a3f4a] px-2.5 py-1 text-[11px] text-[#c8ccd4] hover:bg-[#252830]"
                onClick={() => fileRef.current?.click()}
              >
                Escolher foto…
              </button>
              {avatarData && (
                <button
                  type="button"
                  className="rounded border border-[#3a3f4a] px-2.5 py-1 text-[11px] text-[#f85149] hover:bg-[#252830]"
                  onClick={() => onAvatarData(null)}
                >
                  Remover foto
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                void onPickFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-[12px] text-[#c8ccd4]">Nome</span>
          <input
            className="h-10 w-full rounded border border-[#2d3139] bg-[#12141a] px-3 text-[13px] text-[#e8eaed] outline-none placeholder:text-[#5c6370] focus:border-[#a371f7] focus:ring-1 focus:ring-[#a371f7]/35"
            value={name}
            onChange={(e) => onName(e.target.value)}
            placeholder="Seu nome completo"
            autoFocus
            required
          />
        </label>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-[12px] text-[#c8ccd4]">Email</span>
          <input
            type="email"
            className="h-10 w-full rounded border border-[#2d3139] bg-[#12141a] px-3 text-[13px] text-[#e8eaed] outline-none placeholder:text-[#5c6370] focus:border-[#a371f7] focus:ring-1 focus:ring-[#a371f7]/35"
            value={email}
            onChange={(e) => onEmail(e.target.value)}
            placeholder="voce@empresa.com"
            required
          />
        </label>

        <div className="mt-2 rounded border border-[#2d3139] bg-[#12141a] px-3 py-2.5 text-[11px] leading-snug text-[#8b909a]">
          <p>
            Sem foto própria, usamos o <span className="text-[#c8ccd4]">Gravatar</span> deste
            e-mail. O campo Provedor não altera o avatar.
          </p>
          <button
            type="button"
            className="mt-1.5 text-[11px] text-[#79b8ff] hover:underline"
            onClick={() => void openGravatarSite()}
          >
            Abrir Gravatar →
          </button>
        </div>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-[12px] text-[#c8ccd4]">Provedor</span>
          <select
            className="h-10 w-full rounded border border-[#2d3139] bg-[#12141a] px-3 text-[13px] text-[#e8eaed] outline-none focus:border-[#a371f7] focus:ring-1 focus:ring-[#a371f7]/35"
            value={provider}
            onChange={(e) => onProvider(e.target.value)}
          >
            <option value="Local">Local</option>
            <option value="GitHub">GitHub</option>
            <option value="GitLab">GitLab</option>
            <option value="Bitbucket">Bitbucket</option>
            <option value="Azure DevOps">Azure DevOps</option>
            <option value="Outro">Outro</option>
          </select>
          <span className="mt-1 block text-[10px] text-[#5c6370]">
            Só identifica o host Git (GitHub, GitLab…). Não altera o avatar.
          </span>
        </label>

        {error && (
          <p className="mt-3 text-[12px] text-[#f85149]" role="alert">
            {error}
          </p>
        )}

        <div className="mt-7 flex items-center justify-end gap-2">
          {showCancel && (
            <button
              type="button"
              className="h-9 min-w-[96px] rounded border border-[#3a3f4a] px-4 text-[12px] text-[#e8eaed] hover:bg-[#252830]"
              onClick={onCancel}
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            disabled={busy}
            className="h-9 min-w-[128px] rounded border border-[#a371f7] bg-[#a371f7]/15 px-4 text-[12px] font-medium text-[#e8eaed] hover:bg-[#a371f7]/25 disabled:opacity-40"
          >
            {busy ? "Salvando…" : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

function ProfileDetail({
  profile,
  repoName,
  isRepoDefault,
  canAssociate,
  busy,
  onEdit,
  onAssociate,
  onSsh,
  onDelete,
}: {
  profile: Profile;
  repoName: string | null;
  isRepoDefault: boolean;
  canAssociate: boolean;
  busy: boolean;
  onEdit: () => void;
  onAssociate: () => void;
  onSsh: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="mx-auto max-w-xl px-8 py-8">
      <div className="flex items-start gap-4">
        <UserAvatar
          name={profile.name}
          email={profile.email}
          src={profile.avatarData}
          size={72}
          rounded="xl"
          gradientFallback
        />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[20px] font-semibold tracking-tight text-[#f0f1f4]">
            {profile.name}
          </h1>
          <p className="mt-0.5 truncate text-[13px] text-[#8b909a]">{profile.email}</p>
          <p className="mt-2 text-[11px] leading-snug text-[#6b7280]">
            {profile.avatarData
              ? "Foto personalizada neste perfil."
              : "Avatar via Gravatar deste e-mail (ou inicial). Edite para escolher uma foto."}
          </p>
          <button
            type="button"
            className="mt-1 text-[11px] text-[#79b8ff] hover:underline"
            onClick={() => void openGravatarSite()}
          >
            Abrir Gravatar →
          </button>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {profile.provider && (
              <span className="rounded bg-[#252830] px-2 py-0.5 text-[10px] text-[#a8adb8]">
                {profile.provider}
              </span>
            )}
            {isRepoDefault && (
              <span className="rounded bg-[#238636]/20 px-2 py-0.5 text-[10px] text-[#3dd68c]">
                Ativo no repo
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          className="shrink-0 rounded border border-[#2d3139] px-3 py-1.5 text-[11px] text-[#c8ccd4] hover:bg-[#252830]"
          onClick={onEdit}
        >
          Editar
        </button>
      </div>

      <dl className="mt-6 space-y-0 rounded-lg border border-[#2d3139] bg-[#1c1f26] px-4">
        <Detail label="Nome" value={profile.name} />
        <Detail label="Email" value={profile.email} />
        <Detail label="Provedor" value={profile.provider ?? "Local"} />
        <Detail
          label="Chave SSH"
          value={profile.sshKeyPath ?? "Não configurada — usa o agente SSH do sistema"}
        />
        {repoName && (
          <Detail label="Repo atual" value={`${repoName}${isRepoDefault ? " · associado" : ""}`} />
        )}
      </dl>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!canAssociate || busy || isRepoDefault}
          className="rounded border border-[#a371f7] bg-[#a371f7]/15 px-3.5 py-2 text-[12px] font-medium text-[#e8eaed] hover:bg-[#a371f7]/25 disabled:opacity-40"
          onClick={onAssociate}
        >
          Usar no repo ativo
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded border border-[#2d3139] px-3.5 py-2 text-[12px] text-[#c8ccd4] hover:bg-[#252830]"
          onClick={onSsh}
        >
          <IconKey className="h-3.5 w-3.5" />
          Configurar SSH
        </button>
        <button
          type="button"
          disabled={busy}
          className="rounded border border-[#f85149]/35 px-3.5 py-2 text-[12px] text-[#f85149] hover:bg-[#f85149]/10 disabled:opacity-40"
          onClick={onDelete}
        >
          Remover
        </button>
      </div>

      <p className="mt-8 text-[11px] leading-relaxed text-[#5c6370]">
        Cada repositório pode usar um perfil diferente. O seletor no canto superior direito define a
        assinatura do próximo commit.
      </p>
    </div>
  );
}

function EmptyHint({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <IconCredentials className="mb-3 h-10 w-10 text-[#5c6370]" />
      <p className="text-[14px] text-[#c8ccd4]">Nenhuma identidade selecionada</p>
      <p className="mt-1 max-w-sm text-[12px] text-[#6b7280]">
        Crie um perfil para assinar commits por repositório.
      </p>
      <button
        type="button"
        className="mt-5 rounded border border-[#a371f7] bg-[#a371f7]/15 px-4 py-2 text-[12px] text-[#e8eaed] hover:bg-[#a371f7]/25"
        onClick={onCreate}
      >
        Nova identidade
      </button>
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
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition ${
        selected ? "bg-[#1e3a5f] ring-1 ring-[#3d8bfd]/40" : "hover:bg-[#252830]"
      }`}
    >
      <UserAvatar
        name={profile.name}
        email={profile.email}
        src={profile.avatarData}
        size={36}
        rounded="md"
        gradientFallback
      />
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
    <div className="flex items-start justify-between gap-4 border-b border-[#2d3139]/70 py-3 last:border-0">
      <dt className="shrink-0 text-[10px] uppercase tracking-wide text-[#6b7280]">{label}</dt>
      <dd className="min-w-0 break-all text-right text-[12px] text-[#d8dbe2]">{value}</dd>
    </div>
  );
}

async function openGravatarSite() {
  const url = "https://gravatar.com/";
  try {
    await openUrl(url);
  } catch {
    window.open(url, "_blank");
  }
}
