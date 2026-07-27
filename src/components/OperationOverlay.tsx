import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { useAppStore } from "../stores/appStore";
import { respondSshAskpass, type SshAskpassRequest } from "../lib/api";
import {
  extractSshKeyFromPrompt,
  getCachedPassphrase,
  rememberPassphrase,
  shouldSkipAskpass,
} from "../lib/sshPassphraseMemory";

function friendlyPrompt(raw: string): { title: string; detail: string | null } {
  const lower = raw.toLowerCase();
  if (lower.includes("passphrase") || lower.includes("senha")) {
    const match = raw.match(/['"]([^'"]+)['"]/);
    return {
      title: "Digite a passphrase da chave SSH",
      detail: match?.[1] ?? null,
    };
  }
  return {
    title: raw.trim() || "Autenticação SSH necessária",
    detail: null,
  };
}

/**
 * Push/pull/fetch/clone progress — passphrase SSH entra no mesmo painel.
 */
export function OperationOverlay() {
  const { operation, cancelOperation, dismissOperation } = useAppStore();
  const primaryRef = useRef<HTMLButtonElement>(null);
  const passRef = useRef<HTMLInputElement>(null);

  const [askpass, setAskpass] = useState<SshAskpassRequest | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [dontAskAgain, setDontAskAgain] = useState(false);
  const [askBusy, setAskBusy] = useState(false);

  const done = operation?.done ?? false;
  const waitingSsh = Boolean(askpass) && !done;
  const keyId = askpass ? extractSshKeyFromPrompt(askpass.prompt) : null;

  useEffect(() => {
    let alive = true;
    const unlisten = listen<SshAskpassRequest>("ssh://askpass", (event) => {
      if (!alive) return;
      const req = event.payload;
      const id = extractSshKeyFromPrompt(req.prompt);
      const auto = shouldSkipAskpass(id);
      if (auto) {
        void respondSshAskpass({
          requestId: req.requestId,
          passphrase: auto,
          cancelled: false,
        });
        return;
      }
      setAskpass(req);
      setPassphrase(getCachedPassphrase(id));
      setDontAskAgain(false);
      setAskBusy(false);
    });
    return () => {
      alive = false;
      void unlisten.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    if (waitingSsh) {
      const t = window.setTimeout(() => passRef.current?.focus(), 40);
      return () => window.clearTimeout(t);
    }
    if (operation) {
      primaryRef.current?.focus();
    }
  }, [waitingSsh, operation?.id, done, operation]);

  useEffect(() => {
    if (!operation && !askpass) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (askpass) {
        e.preventDefault();
        void submitAskpass(true);
        return;
      }
      if (!operation) return;
      if (done) dismissOperation();
      else void cancelOperation();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- submitAskpass reads latest state
  }, [operation, askpass, askBusy, done, cancelOperation, dismissOperation, passphrase]);

  const onPassphraseChange = (value: string) => {
    setPassphrase(value);
    if (keyId) rememberPassphrase(keyId, value, dontAskAgain);
  };

  const submitAskpass = async (cancelled: boolean) => {
    if (!askpass || askBusy) return;
    setAskBusy(true);
    const id = extractSshKeyFromPrompt(askpass.prompt);
    try {
      if (!cancelled) {
        rememberPassphrase(id, passphrase, dontAskAgain);
      }
      await respondSshAskpass({
        requestId: askpass.requestId,
        passphrase: cancelled ? null : passphrase,
        cancelled,
      });
    } catch {
      // SSH fails / times out
    } finally {
      setAskpass(null);
      if (cancelled) setPassphrase("");
      setAskBusy(false);
      if (cancelled && operation && !operation.done) {
        void cancelOperation();
      }
    }
  };

  if (!operation && !askpass) return null;

  const label = operation?.label ?? "Autenticação SSH";
  const percent = operation?.percent ?? null;
  const lines = operation?.lines ?? [];
  const success = operation?.success ?? null;
  const tail = lines.slice(-8);
  const sshCopy = askpass ? friendlyPrompt(askpass.prompt) : null;

  const statusText = waitingSsh
    ? "Aguardando passphrase…"
    : done
      ? success
        ? "Concluído"
        : "Finalizado"
      : percent !== null
        ? `${percent}%`
        : "Em progresso";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="operation-title"
    >
      <div className="w-full max-w-lg rounded-[var(--radius-md)] border border-border bg-bg-secondary p-4">
        <div className="mb-3 flex items-center justify-between">
          <div id="operation-title" className="text-sm font-semibold">
            {label}
          </div>
          <div className="text-xs text-text-muted" aria-live="polite">
            {statusText}
          </div>
        </div>

        {operation && (
          <div
            className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-surface"
            role="progressbar"
            aria-label={`Progresso: ${label}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent ?? undefined}
          >
            <div
              className={`h-full transition-all ${
                done
                  ? success
                    ? "bg-success"
                    : "bg-danger"
                  : waitingSsh
                    ? "bg-[#a371f7]/70"
                    : "brand-gradient"
              }`}
              style={{
                width: waitingSsh ? "100%" : `${percent ?? (done ? 100 : 8)}%`,
              }}
            />
          </div>
        )}

        {operation && (
          <pre
            className="mb-3 max-h-28 overflow-auto rounded-[var(--radius-sm)] border border-border bg-bg p-2 font-mono text-[11px] leading-4 text-text-muted"
            aria-live="polite"
            aria-label="Saída da operação"
          >
            {tail.length === 0 ? "Iniciando…" : tail.join("\n")}
          </pre>
        )}

        {waitingSsh && sshCopy && (
          <form
            className="mb-3 rounded-[var(--radius-sm)] border border-[#a371f7]/35 bg-[#a371f7]/8 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void submitAskpass(false);
            }}
          >
            <p className="text-[12px] font-medium text-[#e8eaed]">{sshCopy.title}</p>
            {sshCopy.detail && (
              <p
                className="mt-1 truncate font-mono text-[11px] text-[#8b909a]"
                title={sshCopy.detail}
              >
                {sshCopy.detail}
              </p>
            )}
            <label className="mt-2.5 block text-[10px] font-medium uppercase tracking-wide text-[#6b7280]">
              Passphrase
              <input
                ref={passRef}
                type="password"
                autoComplete="current-password"
                value={passphrase}
                disabled={askBusy}
                onChange={(e) => onPassphraseChange(e.target.value)}
                className="mt-1 h-9 w-full rounded border border-border bg-bg px-3 text-[13px] text-[#f0f1f4] outline-none focus:border-[#a371f7]"
              />
            </label>
            <label className="mt-2.5 flex cursor-pointer items-center gap-2 text-[12px] text-[#c8ccd4]">
              <input
                type="checkbox"
                checked={dontAskAgain}
                disabled={askBusy}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setDontAskAgain(checked);
                  if (keyId) rememberPassphrase(keyId, passphrase, checked);
                }}
                className="h-3.5 w-3.5 accent-[#a371f7]"
              />
              Não perguntar novamente nesta sessão
            </label>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                disabled={askBusy}
                onClick={() => void submitAskpass(true)}
                className="rounded-[var(--radius-sm)] border border-border px-3 py-1.5 text-xs text-danger hover:bg-surface"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={askBusy}
                className="rounded-[var(--radius-sm)] border border-[#a371f7] bg-[#a371f7]/20 px-3 py-1.5 text-xs font-medium text-[#e8eaed] hover:bg-[#a371f7]/30"
              >
                Confirmar
              </button>
            </div>
          </form>
        )}

        {!waitingSsh && (
          <div className="flex justify-end gap-2">
            {!done && operation ? (
              <button
                ref={primaryRef}
                type="button"
                onClick={() => void cancelOperation()}
                className="rounded-[var(--radius-sm)] border border-border px-3 py-1.5 text-xs text-danger hover:bg-surface"
              >
                Cancelar
              </button>
            ) : operation ? (
              <button
                ref={primaryRef}
                type="button"
                onClick={dismissOperation}
                className="rounded-[var(--radius-sm)] border border-border px-3 py-1.5 text-xs hover:bg-surface"
              >
                Fechar
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
