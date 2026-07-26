import { useState } from "react";
import { useAppStore } from "../../stores/appStore";
import type { FileChange, Profile } from "../../lib/api";

export function RightPanel() {
  const {
    rightTab,
    setRightTab,
    status,
    repositories,
    activeRepoId,
    profiles,
    commitMessage,
    setCommitMessage,
    commitOverrideProfileId,
    setCommitOverrideProfileId,
    stage,
    unstage,
    selectFile,
    selectedFile,
    commit,
    createProfile,
    deleteProfile,
    associateProfile,
    busy,
  } = useAppStore();

  const repo = repositories.find((r) => r.id === activeRepoId);
  const activeProfile =
    profiles.find((p) => p.id === commitOverrideProfileId) ??
    repo?.activeProfile ??
    null;

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-border bg-bg-secondary">
      <div className="flex border-b border-border text-sm">
        <Tab
          label="Changes"
          active={rightTab === "changes"}
          onClick={() => setRightTab("changes")}
        />
        <Tab
          label="Credentials"
          active={rightTab === "credentials"}
          onClick={() => setRightTab("credentials")}
        />
      </div>

      {rightTab === "changes" ? (
        <>
          <div className="flex-1 space-y-4 overflow-auto p-3 text-sm">
            <FileGroup
              title="Staged Changes"
              files={status?.staged ?? []}
              empty="Nenhum arquivo staged."
              actionLabel="Unstage"
              onAction={(paths) => void unstage(paths)}
              onSelect={(file) => void selectFile(file)}
              selected={selectedFile}
              disabled={busy || !repo}
            />
            <FileGroup
              title="Unstaged Changes"
              files={status?.unstaged ?? []}
              empty={repo ? "Working tree limpa." : "Abra um repositório para ver mudanças."}
              actionLabel="Stage"
              onAction={(paths) => void stage(paths)}
              onSelect={(file) => void selectFile(file)}
              selected={selectedFile}
              disabled={busy || !repo}
            />
          </div>

          <div className="border-t border-border p-3">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="text-text-muted">Identidade do commit</span>
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

            <textarea
              className="mb-3 h-20 w-full resize-none rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-50"
              placeholder="Mensagem do commit"
              value={commitMessage}
              disabled={!repo || busy}
              onChange={(e) => setCommitMessage(e.target.value)}
            />
            <button
              type="button"
              disabled={!repo || busy || !commitMessage.trim() || !activeProfile}
              onClick={() => void commit()}
              className="brand-gradient w-full rounded-[var(--radius-sm)] px-3 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-40"
            >
              Commit
            </button>
          </div>
        </>
      ) : (
        <CredentialsPanel
          profiles={profiles}
          activeProfileId={repo?.defaultProfileId ?? null}
          onCreate={(input) => void createProfile(input)}
          onDelete={(id) => void deleteProfile(id)}
          onAssociate={(id) => void associateProfile(id)}
          busy={busy}
          hasRepo={Boolean(repo)}
        />
      )}
    </aside>
  );
}

function Tab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 px-3 py-2.5 text-left transition ${
        active
          ? "border-b-2 border-primary text-text"
          : "border-b-2 border-transparent text-text-muted hover:text-text"
      }`}
    >
      {label}
    </button>
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
        <div className="rounded-[var(--radius-sm)] border border-dashed border-border px-3 py-4 text-xs text-text-muted">
          {empty}
        </div>
      ) : (
        <ul className="space-y-0.5">
          {files.map((file) => {
            const isSelected =
              selected?.path === file.path && selected.staged === file.staged;
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

function CredentialsPanel({
  profiles,
  activeProfileId,
  onCreate,
  onDelete,
  onAssociate,
  busy,
  hasRepo,
}: {
  profiles: Profile[];
  activeProfileId: string | null;
  onCreate: (input: { name: string; email: string; provider?: string }) => void;
  onDelete: (id: string) => void;
  onAssociate: (id: string | null) => void;
  busy: boolean;
  hasRepo: boolean;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [provider, setProvider] = useState("GitHub");

  return (
    <div className="flex-1 space-y-4 overflow-auto p-3 text-sm">
      <div>
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">
          Perfis
        </div>
        {profiles.length === 0 ? (
          <div className="rounded-[var(--radius-sm)] border border-dashed border-border px-3 py-4 text-xs text-text-muted">
            Cadastre um perfil para commits com identidade correta.
          </div>
        ) : (
          <ul className="space-y-2">
            {profiles.map((profile) => {
              const active = profile.id === activeProfileId;
              return (
                <li
                  key={profile.id}
                  className="rounded-[var(--radius-md)] border border-border bg-surface p-3"
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <div className="font-medium">{profile.name}</div>
                    {active && (
                      <span className="rounded-full bg-success/20 px-2 py-0.5 text-[10px] text-success">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-text-muted">{profile.email}</div>
                  {profile.provider && (
                    <div className="mt-1 text-[11px] text-text-muted">{profile.provider}</div>
                  )}
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={!hasRepo || busy || active}
                      className="text-xs text-primary disabled:opacity-40"
                      onClick={() => onAssociate(profile.id)}
                    >
                      Usar neste repo
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      className="text-xs text-danger disabled:opacity-40"
                      onClick={() => onDelete(profile.id)}
                    >
                      Remover
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <form
        className="space-y-2 rounded-[var(--radius-md)] border border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          onCreate({ name, email, provider });
          setName("");
          setEmail("");
        }}
      >
        <div className="text-xs font-medium uppercase tracking-wide text-text-muted">
          Novo perfil
        </div>
        <input
          className="w-full rounded-[var(--radius-sm)] border border-border bg-bg px-2 py-1.5 text-sm outline-none focus:border-primary"
          placeholder="Nome"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className="w-full rounded-[var(--radius-sm)] border border-border bg-bg px-2 py-1.5 text-sm outline-none focus:border-primary"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <select
          className="w-full rounded-[var(--radius-sm)] border border-border bg-bg px-2 py-1.5 text-sm outline-none focus:border-primary"
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
          className="brand-gradient w-full rounded-[var(--radius-sm)] px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          Criar perfil
        </button>
      </form>
    </div>
  );
}
