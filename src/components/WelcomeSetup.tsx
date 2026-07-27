import { useEffect, useState, type FormEvent } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { homeDir, join } from "@tauri-apps/api/path";
import { getCurrentWindow } from "@tauri-apps/api/window";
import logo from "../assets/brand/logo.png";
import { useAppStore } from "../stores/appStore";
import { usePrefsStore } from "../stores/prefsStore";
import { applyMainWindow } from "../lib/windowLayout";

/**
 * First-run setup inspired by Fork:
 * left branding + step list · right user information form · Finish / Cancel.
 */
export function WelcomeSetup({ onComplete }: { onComplete: () => void }) {
  const createProfile = useAppStore((s) => s.createProfile);
  const refreshProfiles = useAppStore((s) => s.refreshProfiles);
  const busy = useAppStore((s) => s.busy);
  const setPref = usePrefsStore((s) => s.setPref);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [projectsPath, setProjectsPath] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const home = await homeDir();
        const suggested = await join(home, "Projects");
        if (!cancelled) setProjectsPath(suggested);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pickFolder = async () => {
    try {
      const home = await homeDir();
      const suggested = await join(home, "Projects");
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Pasta padrão de projetos",
        defaultPath: projectsPath || suggested,
      });
      if (typeof selected === "string") setProjectsPath(selected);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const cancel = async () => {
    try {
      await getCurrentWindow().close();
    } catch {
      /* ignore */
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !email.trim() || !projectsPath.trim()) {
      setError("Preencha nome, email e a pasta de projetos.");
      return;
    }
    setSubmitting(true);
    try {
      await createProfile(
        {
          name: name.trim(),
          email: email.trim(),
          provider: "Local",
        },
        { stay: true },
      );
      await refreshProfiles();
      setPref("projectsPath", projectsPath.trim());
      setPref("onboardingComplete", true);
      await applyMainWindow();
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 bg-[#1a1c22]">
      {/* Left — branding + steps (Fork-style) */}
      <aside className="flex w-[240px] shrink-0 flex-col bg-[#14161b] px-5 pb-5 pt-8">
        <div className="flex flex-col items-center text-center">
          <img src={logo} alt="" className="h-[72px] w-[72px] object-contain" aria-hidden />
          <h1 className="mt-4 text-[18px] font-semibold tracking-tight text-[#f0f1f4]">
            Bem-vindo ao Gitorade
          </h1>
        </div>

        <nav className="mt-auto space-y-0.5 pt-8" aria-label="Etapas">
          <div className="rounded bg-[#2a2e36] px-3 py-2 text-[12px] text-[#e8eaed]">
            Informações do usuário
          </div>
          <div className="px-3 py-2 text-[12px] text-[#5c6370]">Preferências</div>
          <div className="px-3 py-2 text-[12px] text-[#5c6370]">Concluído</div>
        </nav>
      </aside>

      {/* Right — form */}
      <form
        className="flex min-w-0 flex-1 flex-col px-8 pb-5 pt-7"
        onSubmit={(e) => void submit(e)}
      >
        <h2 className="text-[20px] font-semibold tracking-tight text-[#f0f1f4]">
          Informações do usuário
        </h2>
        <p className="mt-2 max-w-md text-[12px] leading-relaxed text-[#8b909a]">
          Defina seu nome e email. Essas informações serão associadas aos seus commits no Git.
        </p>

        <label className="mt-6 block">
          <span className="mb-1.5 block text-[12px] text-[#c8ccd4]">Nome:</span>
          <input
            className="h-9 w-full rounded border border-[#2d3139] bg-[#12141a] px-3 text-[13px] text-[#e8eaed] outline-none placeholder:text-[#5c6370] focus:border-[#a371f7] focus:ring-1 focus:ring-[#a371f7]/40"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome completo (opcional)"
            autoFocus
            required
          />
        </label>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-[12px] text-[#c8ccd4]">Email:</span>
          <input
            type="email"
            className="h-9 w-full rounded border border-[#2d3139] bg-[#12141a] px-3 text-[13px] text-[#e8eaed] outline-none placeholder:text-[#5c6370] focus:border-[#a371f7] focus:ring-1 focus:ring-[#a371f7]/40"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@dominio.com (opcional)"
            required
          />
        </label>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-[12px] text-[#c8ccd4]">Pasta padrão de projetos:</span>
          <div className="flex gap-2">
            <input
              className="h-9 min-w-0 flex-1 rounded border border-[#2d3139] bg-[#12141a] px-3 font-mono text-[12px] text-[#e8eaed] outline-none focus:border-[#a371f7] focus:ring-1 focus:ring-[#a371f7]/40"
              value={projectsPath}
              onChange={(e) => setProjectsPath(e.target.value)}
              placeholder="C:\Users\...\Projects"
              required
            />
            <button
              type="button"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded border border-[#2d3139] text-[#c8ccd4] hover:bg-[#252830]"
              title="Escolher pasta"
              onClick={() => void pickFolder()}
            >
              <FolderGlyph />
            </button>
          </div>
        </label>

        {error && (
          <p className="mt-3 text-[11px] text-[#f85149]" role="alert">
            {error}
          </p>
        )}

        <div className="mt-auto flex justify-end gap-2 pt-6">
          <button
            type="button"
            className="h-8 min-w-[88px] rounded border border-[#3a3f4a] px-4 text-[12px] text-[#e8eaed] hover:bg-[#252830]"
            onClick={() => void cancel()}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={busy || submitting}
            className="h-8 min-w-[88px] rounded border border-[#a371f7] bg-transparent px-4 text-[12px] font-medium text-[#e8eaed] hover:bg-[#a371f7]/15 disabled:opacity-40"
          >
            {submitting ? "Salvando…" : "Concluir"}
          </button>
        </div>
      </form>
    </div>
  );
}

function FolderGlyph() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <path d="M3 7h6l2 2h10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    </svg>
  );
}
