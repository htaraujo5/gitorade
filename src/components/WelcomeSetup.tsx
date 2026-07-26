import { useEffect, useState, type FormEvent } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { homeDir, join } from "@tauri-apps/api/path";
import logo from "../assets/brand/logo.png";
import { useAppStore } from "../stores/appStore";
import { usePrefsStore } from "../stores/prefsStore";
import { applyMainWindow } from "../lib/windowLayout";

/**
 * First-run setup (Fork/GitKraken-style): compact window,
 * logo + form (name, email, projects folder) → main dashboard.
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
    <div className="flex h-full min-h-0 bg-[#12141a]">
      <div
        className="relative flex w-[42%] shrink-0 flex-col items-center justify-center overflow-hidden px-8"
        style={{
          background:
            "radial-gradient(ellipse 80% 70% at 50% 40%, rgba(107,92,255,0.35), transparent 60%), #171a20",
        }}
      >
        <img
          src={logo}
          alt=""
          className="h-28 w-28 object-contain drop-shadow-[0_12px_40px_rgba(160,80,220,0.45)]"
          aria-hidden
        />
        <div className="mt-5 text-center">
          <div className="text-[22px] font-semibold tracking-tight text-[#f0f1f4]">
            gitorade
          </div>
          <p className="mt-1.5 max-w-[200px] text-[12px] leading-relaxed text-[#8b909a]">
            Seu Git. Seu fluxo. Seu jeito.
          </p>
        </div>
      </div>

      <form
        className="flex min-w-0 flex-1 flex-col justify-center px-8 py-7"
        onSubmit={(e) => void submit(e)}
      >
        <h1 className="text-[18px] font-medium text-[#f0f1f4]">
          Configure sua identidade
        </h1>
        <p className="mt-1 text-[12px] text-[#6b7280]">
          Usada nos commits. Você pode criar outras depois em Credenciais.
        </p>

        <label className="mt-5 block">
          <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[#6b7280]">
            Nome
          </span>
          <input
            className="h-9 w-full rounded border border-[#2d3139] bg-[#1c1f26] px-3 text-[13px] text-[#e8eaed] outline-none focus:border-[#3d8bfd]"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Seu nome"
            autoFocus
            required
          />
        </label>

        <label className="mt-3 block">
          <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[#6b7280]">
            Email
          </span>
          <input
            type="email"
            className="h-9 w-full rounded border border-[#2d3139] bg-[#1c1f26] px-3 text-[13px] text-[#e8eaed] outline-none focus:border-[#3d8bfd]"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@empresa.com"
            required
          />
        </label>

        <label className="mt-3 block">
          <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[#6b7280]">
            Pasta de projetos
          </span>
          <div className="flex gap-2">
            <input
              className="h-9 min-w-0 flex-1 rounded border border-[#2d3139] bg-[#1c1f26] px-3 font-mono text-[12px] text-[#e8eaed] outline-none focus:border-[#3d8bfd]"
              value={projectsPath}
              onChange={(e) => setProjectsPath(e.target.value)}
              placeholder="C:\Users\...\Projects"
              required
            />
            <button
              type="button"
              className="h-9 shrink-0 rounded border border-[#2d3139] px-3 text-[12px] text-[#c8ccd4] hover:bg-[#252830]"
              onClick={() => void pickFolder()}
            >
              …
            </button>
          </div>
        </label>

        {error && (
          <p className="mt-3 text-[11px] text-[#f85149]" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || submitting}
          className="mt-6 h-10 w-full rounded bg-gradient-to-r from-[#6b5cff] to-[#e040a0] text-[13px] font-medium text-white disabled:opacity-40"
        >
          {submitting ? "Configurando…" : "Começar"}
        </button>
      </form>
    </div>
  );
}
