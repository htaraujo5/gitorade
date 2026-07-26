import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { respondSshAskpass, type SshAskpassRequest } from "../lib/api";

function friendlyPrompt(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("passphrase") || lower.includes("senha")) {
    const match = raw.match(/['"]([^'"]+)['"]/);
    if (match?.[1]) {
      return `Digite a passphrase da chave:\n${match[1]}`;
    }
    return "Digite a passphrase da sua chave SSH.";
  }
  return raw.trim() || "Autenticação SSH necessária.";
}

/**
 * In-app SSH passphrase prompt (replaces the external WinForms/PowerShell dialog).
 */
export function SshAskpassModal() {
  const [req, setReq] = useState<SshAskpassRequest | null>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    const unlisten = listen<SshAskpassRequest>("ssh://askpass", (event) => {
      if (!alive) return;
      setReq(event.payload);
      setValue("");
      setBusy(false);
    });
    return () => {
      alive = false;
      void unlisten.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    if (!req) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, [req]);

  if (!req) return null;

  const submit = async (cancelled: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      await respondSshAskpass({
        requestId: req.requestId,
        passphrase: cancelled ? null : value,
        cancelled,
      });
    } catch {
      // SSH will fail / timeout — UI just closes.
    } finally {
      setReq(null);
      setValue("");
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ssh-askpass-title"
    >
      <div className="w-full max-w-md rounded-lg border border-[#3a3f4b] bg-[#1c1f26] shadow-2xl shadow-black/50">
        <div className="border-b border-[#2d3139] px-4 py-3">
          <h2
            id="ssh-askpass-title"
            className="text-[14px] font-medium text-[#f0f1f4]"
          >
            Autenticação SSH
          </h2>
          <p className="mt-1 whitespace-pre-line text-[12px] leading-relaxed text-[#8b909a]">
            {friendlyPrompt(req.prompt)}
          </p>
        </div>
        <form
          className="px-4 py-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(false);
          }}
        >
          <label className="block text-[11px] font-medium uppercase tracking-wide text-[#6b7280]">
            Passphrase
            <input
              ref={inputRef}
              type="password"
              autoComplete="current-password"
              value={value}
              disabled={busy}
              onChange={(e) => setValue(e.target.value)}
              className="mt-1.5 h-9 w-full rounded border border-[#3a3f4b] bg-[#12141a] px-3 text-[13px] text-[#f0f1f4] outline-none focus:border-[#a371f7]"
            />
          </label>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void submit(true)}
              className="h-8 min-w-[88px] rounded border border-[#3a3f4b] px-4 text-[12px] text-[#c8ccd4] hover:bg-[#252830]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy}
              className="h-8 min-w-[88px] rounded border border-[#a371f7] bg-[#a371f7]/15 px-4 text-[12px] font-medium text-[#e8eaed] hover:bg-[#a371f7]/25"
            >
              Confirmar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
