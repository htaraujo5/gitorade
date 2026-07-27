import { useEffect, useState, type ReactNode } from "react";
import { useAppStore } from "../../stores/appStore";
import { usePrefsStore, type AppPrefs } from "../../stores/prefsStore";
import { useT, type MessageKey } from "../../i18n";
import logo from "../../assets/brand/logo.png";
import {
  IconAbout,
  IconCredentials,
  IconKey,
  IconPlugins,
  IconSettings,
  IconTerminal,
} from "../Icons";

type SectionId =
  "general" | "appearance" | "git" | "terminal" | "identity" | "ssh" | "plugins" | "about";

const sectionDefs: { id: SectionId; labelKey: MessageKey; icon: ReactNode }[] = [
  {
    id: "general",
    labelKey: "settings.section.general",
    icon: <IconSettings className="h-3.5 w-3.5" />,
  },
  {
    id: "appearance",
    labelKey: "settings.section.appearance",
    icon: <IconAbout className="h-3.5 w-3.5" />,
  },
  { id: "git", labelKey: "settings.section.git", icon: <IconSettings className="h-3.5 w-3.5" /> },
  {
    id: "terminal",
    labelKey: "settings.section.terminal",
    icon: <IconTerminal className="h-3.5 w-3.5" />,
  },
  {
    id: "identity",
    labelKey: "settings.section.identity",
    icon: <IconCredentials className="h-3.5 w-3.5" />,
  },
  { id: "ssh", labelKey: "settings.section.ssh", icon: <IconKey className="h-3.5 w-3.5" /> },
  {
    id: "plugins",
    labelKey: "settings.section.plugins",
    icon: <IconPlugins className="h-3.5 w-3.5" />,
  },
  { id: "about", labelKey: "settings.section.about", icon: <IconAbout className="h-3.5 w-3.5" /> },
];

/** Preferences tab: left categories + working options (GitKraken-like). */
export function SettingsPage({ initialSection = "general" }: { initialSection?: SectionId }) {
  const t = useT();
  const [section, setSection] = useState<SectionId>(initialSection);
  const [showSaved, setShowSaved] = useState(false);
  const prefs = usePrefsStore();
  const prefsSavedAt = usePrefsStore((s) => s.prefsSavedAt);
  const clearPrefsSaved = usePrefsStore((s) => s.clearPrefsSaved);
  const { health, profiles, openCredentialsTab } = useAppStore();

  useEffect(() => {
    if (!prefsSavedAt) return;
    setShowSaved(true);
    const hide = window.setTimeout(() => {
      setShowSaved(false);
      clearPrefsSaved();
    }, 1600);
    return () => window.clearTimeout(hide);
  }, [prefsSavedAt, clearPrefsSaved]);

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-[#171a20]">
      <aside className="flex w-44 shrink-0 flex-col border-r border-[#2d3139] bg-[#1c1f26]">
        <div className="border-b border-[#2d3139] px-2.5 py-2">
          <div className="text-[11px] font-medium text-[#e8eaed]">{t("settings.title")}</div>
          <div className="text-[9px] text-[#6b7280]">{t("settings.subtitle")}</div>
        </div>
        <nav className="flex-1 space-y-px overflow-auto p-1.5">
          {sectionDefs.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(s.id)}
              className={`flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-[11px] leading-tight ${
                section === s.id
                  ? "bg-[#1e3a5f] text-[#e8eaed]"
                  : "text-[#8b909a] hover:bg-[#252830] hover:text-[#d8dbe2]"
              }`}
            >
              <span className="shrink-0 opacity-80">{s.icon}</span>
              {t(s.labelKey)}
            </button>
          ))}
        </nav>
        <div className="border-t border-[#2d3139] p-1.5">
          <button
            type="button"
            className="w-full rounded px-2 py-1 text-[10px] text-[#8b909a] hover:bg-[#252830] hover:text-[#d8dbe2]"
            onClick={() => prefs.resetPrefs()}
          >
            {t("settings.reset")}
          </button>
        </div>
      </aside>

      <div className="relative min-h-0 min-w-0 flex-1 overflow-auto p-5">
        <div
          className={`pointer-events-none absolute right-5 top-4 z-10 transition-opacity duration-300 ${
            showSaved ? "opacity-100" : "opacity-0"
          }`}
          aria-live="polite"
        >
          <span className="inline-flex items-center gap-1.5 rounded-md border border-[#238636]/50 bg-[#238636]/15 px-2.5 py-1 text-[11px] font-medium text-[#3dd68c] shadow-lg shadow-black/30">
            <span aria-hidden>✓</span>
            {t("common.saved")}
          </span>
        </div>
        <div className="mx-auto max-w-xl space-y-3.5">
          {section === "general" && (
            <>
              <Header title={t("settings.general.title")} desc={t("settings.general.desc")} />
              <SelectRow
                label={t("settings.language")}
                value={prefs.language}
                options={[
                  { value: "pt-BR", label: t("settings.lang.pt") },
                  { value: "en", label: t("settings.lang.en") },
                ]}
                onChange={(v) => prefs.setPref("language", v as AppPrefs["language"])}
              />
              <ToggleRow
                label={t("settings.confirmDangerous")}
                hint={t("settings.confirmDangerous.hint")}
                checked={prefs.confirmDangerous}
                onChange={(v) => prefs.setPref("confirmDangerous", v)}
              />
              <ToggleRow
                label={t("settings.openLastRepo")}
                hint={t("settings.openLastRepo.hint")}
                checked={prefs.openLastRepoOnStart}
                onChange={(v) => prefs.setPref("openLastRepoOnStart", v)}
              />
              <div className="rounded border border-[#2d3139] bg-[#1c1f26] px-2.5 py-2">
                <div className="mb-1 text-[11px] text-[#e8eaed]">{t("settings.projectsPath")}</div>
                <div className="mb-1.5 text-[10px] leading-snug text-[#6b7280]">
                  {t("settings.projectsPath.hint")}
                </div>
                <input
                  className="w-full rounded border border-[#2d3139] bg-[#12141a] px-2 py-1 font-mono text-[11px] text-[#d8dbe2] outline-none focus:border-[#3d8bfd]"
                  value={prefs.projectsPath}
                  onChange={(e) => prefs.setPref("projectsPath", e.target.value)}
                  placeholder="C:\Users\...\Projects"
                />
              </div>
            </>
          )}

          {section === "appearance" && (
            <>
              <Header title={t("settings.appearance.title")} desc={t("settings.appearance.desc")} />
              <ToggleRow
                label={t("settings.avatars")}
                hint={t("settings.avatars.hint")}
                checked={prefs.showAvatars}
                onChange={(v) => prefs.setPref("showAvatars", v)}
              />
              <ToggleRow
                label={t("settings.relativeDates")}
                hint={t("settings.relativeDates.hint")}
                checked={prefs.relativeDates}
                onChange={(v) => prefs.setPref("relativeDates", v)}
              />
              <SelectRow
                label={t("settings.diffLayout")}
                value={prefs.diffLayout}
                options={[
                  { value: "unified", label: t("settings.diff.unified") },
                  { value: "split", label: t("settings.diff.split") },
                ]}
                onChange={(v) => prefs.setPref("diffLayout", v as AppPrefs["diffLayout"])}
              />
            </>
          )}

          {section === "git" && (
            <>
              <Header title={t("settings.git.title")} desc={t("settings.git.desc")} />
              <NumberRow
                label={t("settings.graphLimit")}
                hint={t("settings.graphLimit.hint")}
                value={prefs.graphCommitLimit}
                min={50}
                max={500}
                step={25}
                onChange={(v) => prefs.setPref("graphCommitLimit", v)}
              />
              <NumberRow
                label={t("settings.statusPoll")}
                hint={t("settings.statusPoll.hint")}
                value={prefs.statusPollSeconds}
                min={2}
                max={30}
                step={1}
                onChange={(v) => prefs.setPref("statusPollSeconds", v)}
              />
              <InfoCard title={t("settings.gitSystem")}>
                <p>
                  {health?.git.available
                    ? t("settings.gitAvailable", {
                        version: health.git.version ?? t("settings.gitUnknownVersion"),
                      })
                    : (health?.git.message ?? t("settings.gitMissing"))}
                </p>
                {health?.git.path && (
                  <p className="mt-1 font-mono text-[11px] text-[#6b7280]">{health.git.path}</p>
                )}
              </InfoCard>
            </>
          )}

          {section === "terminal" && (
            <>
              <Header title={t("settings.terminal.title")} desc={t("settings.terminal.desc")} />
              <ToggleRow
                label={t("settings.enableTerminal")}
                checked={prefs.enableTerminal}
                onChange={(v) => {
                  prefs.setPref("enableTerminal", v);
                  void import("../../lib/api").then((api) => api.terminalSetEnabled(v));
                  if (!v) useAppStore.getState().setTerminalOpen(false);
                }}
              />
              <NumberRow
                label={t("settings.terminalFont")}
                value={prefs.terminalFontSize}
                min={10}
                max={18}
                step={1}
                onChange={(v) => prefs.setPref("terminalFontSize", v)}
              />
              <ToggleRow
                label={t("settings.terminalOpenDefault")}
                checked={prefs.terminalOpenByDefault}
                onChange={(v) => prefs.setPref("terminalOpenByDefault", v)}
              />
            </>
          )}

          {section === "identity" && (
            <>
              <Header title={t("settings.identity.title")} desc={t("settings.identity.desc")} />
              <InfoCard title={t("settings.identity.profiles")}>
                {profiles.length === 0 ? (
                  <p>{t("settings.identity.empty")}</p>
                ) : (
                  <ul className="space-y-1.5">
                    {profiles.map((p) => (
                      <li key={p.id} className="flex justify-between gap-2 text-[12px]">
                        <span className="truncate text-[#e8eaed]">{p.name}</span>
                        <span className="truncate text-[#6b7280]">{p.email}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </InfoCard>
              <button
                type="button"
                className="rounded border border-[#3d8bfd]/40 bg-[#1e3a5f]/30 px-3 py-2 text-[12px] text-[#8bb4f0] hover:bg-[#1e3a5f]"
                onClick={() => openCredentialsTab()}
              >
                {t("settings.identity.open")}
              </button>
            </>
          )}

          {section === "ssh" && <SshSection />}
          {section === "plugins" && <PluginsSection />}
          {section === "about" && <AboutSection />}
        </div>
      </div>
    </div>
  );
}

export function SshKeysPage() {
  const t = useT();
  return (
    <div className="flex min-h-0 flex-1 overflow-auto bg-[#171a20] p-6">
      <div className="mx-auto w-full max-w-xl space-y-5">
        <Header title={t("settings.ssh.title")} desc={t("settings.ssh.desc")} />
        <SshSection />
      </div>
    </div>
  );
}

export function PluginsPage() {
  const t = useT();
  return (
    <div className="flex min-h-0 flex-1 overflow-auto bg-[#171a20] p-6">
      <div className="mx-auto w-full max-w-xl space-y-5">
        <Header title={t("settings.plugins.title")} desc={t("settings.plugins.desc")} />
        <PluginsSection />
      </div>
    </div>
  );
}

export function AboutPage() {
  return (
    <div className="flex min-h-0 flex-1 overflow-auto bg-[#171a20] p-6">
      <div className="mx-auto w-full max-w-xl space-y-5">
        <AboutSection />
      </div>
    </div>
  );
}

function SshSection() {
  const { profiles, refreshProfiles, busy, setAppView } = useAppStore();
  const [notice, setNotice] = useState<string | null>(null);

  const pickKey = async (profileId: string) => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        multiple: false,
        title: "Selecionar chave privada SSH",
      });
      if (!selected || Array.isArray(selected)) return;
      const profile = profiles.find((p) => p.id === profileId);
      if (!profile) return;
      const { updateProfile } = await import("../../lib/api");
      await updateProfile({
        id: profile.id,
        name: profile.name,
        email: profile.email,
        provider: profile.provider,
        sshKeyPath: selected,
        avatarData: profile.avatarData ?? null,
      });
      await refreshProfiles();
      setNotice(`Chave associada a ${profile.name}`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <>
      <InfoCard title="Agente SSH">
        <p>
          O Gitorade usa o SSH Agent do Windows / Git Credential Manager para autenticação em
          remotes. Associe uma chave privada a um perfil para referência (path).
        </p>
        <p className="mt-2 text-[11px] text-[#6b7280]">
          Dica: <code className="text-[#8b909a]">ssh-add -l</code> lista chaves carregadas no
          agente.
        </p>
      </InfoCard>

      {notice && (
        <div className="rounded border border-[#2d3139] bg-[#1c1f26] px-3 py-2 text-[11px] text-[#8bb4f0]">
          {notice}
        </div>
      )}

      <div className="space-y-2">
        <div className="text-[11px] font-medium uppercase tracking-wide text-[#6b7280]">
          Chaves por perfil
        </div>
        {profiles.length === 0 ? (
          <p className="text-[12px] text-[#6b7280]">
            Crie um perfil em Credenciais para vincular uma chave.
          </p>
        ) : (
          profiles.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2 rounded border border-[#2d3139] bg-[#1c1f26] px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] text-[#e8eaed]">{p.name}</div>
                <div className="truncate font-mono text-[10px] text-[#6b7280]">
                  {p.sshKeyPath ?? "Nenhuma chave associada"}
                </div>
              </div>
              <button
                type="button"
                disabled={busy}
                className="shrink-0 rounded border border-[#2d3139] px-2 py-1 text-[10px] text-[#c8ccd4] hover:bg-[#252830] disabled:opacity-40"
                onClick={() => void pickKey(p.id)}
              >
                Escolher…
              </button>
            </div>
          ))
        )}
      </div>

      <button
        type="button"
        className="text-[12px] text-[#3d8bfd] hover:underline"
        onClick={() => setAppView("credentials")}
      >
        Gerenciar perfis →
      </button>
    </>
  );
}

function PluginsSection() {
  const t = useT();
  return (
    <InfoCard title={t("settings.plugins.title")}>
      <p>{t("settings.plugins.soon")}</p>
    </InfoCard>
  );
}

function AboutSection() {
  const t = useT();
  const health = useAppStore((s) => s.health);
  return (
    <>
      <div className="flex flex-col items-center gap-4 self-center text-center">
        <img src={logo} alt="" className="h-28 w-28 object-contain" aria-hidden />
        <div>
          <div className="text-[28px] font-semibold tracking-tight text-[#f0f1f4]">gitorade</div>
          <p className="mt-1 text-[14px] text-[#8b909a]">{t("dash.tagline")}</p>
        </div>
      </div>
      <InfoCard title={t("settings.about.title")}>
        <p>{t("settings.about.version", { version: health?.appVersion ?? "0.1.0" })}</p>
        <p className="mt-2 text-[12px] text-[#8b909a]">{t("settings.about.desc")}</p>
      </InfoCard>
    </>
  );
}

function Header({ title, desc }: { title: string; desc: string }) {
  return (
    <div>
      <h1 className="text-[14px] font-medium text-[#e8eaed]">{title}</h1>
      <p className="mt-0.5 text-[11px] leading-snug text-[#6b7280]">{desc}</p>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded border border-[#2d3139] bg-[#1c1f26] px-2.5 py-2">
      <div className="mb-1 text-[9px] font-medium uppercase tracking-wide text-[#6b7280]">
        {title}
      </div>
      <div className="text-[11px] leading-snug text-[#c8ccd4]">{children}</div>
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 rounded border border-[#2d3139] bg-[#1c1f26] px-2.5 py-2">
      <div className="min-w-0">
        <div className="text-[11px] leading-snug text-[#e8eaed]">{label}</div>
        {hint && <div className="mt-0.5 text-[10px] leading-snug text-[#6b7280]">{hint}</div>}
      </div>
      <input
        type="checkbox"
        className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[#3d8bfd]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

function SelectRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="rounded border border-[#2d3139] bg-[#1c1f26] px-2.5 py-2">
      <div className="mb-1 text-[11px] text-[#e8eaed]">{label}</div>
      <select
        className="w-full rounded border border-[#2d3139] bg-[#12141a] px-2 py-1 text-[11px] text-[#d8dbe2] outline-none focus:border-[#3d8bfd]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function NumberRow({
  label,
  hint,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="rounded border border-[#2d3139] bg-[#1c1f26] px-2.5 py-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="text-[11px] text-[#e8eaed]">{label}</div>
        <span className="font-mono text-[10px] text-[#8b909a]">{value}</span>
      </div>
      {hint && <div className="mb-1.5 text-[10px] leading-snug text-[#6b7280]">{hint}</div>}
      <input
        type="range"
        className="w-full accent-[#3d8bfd]"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
