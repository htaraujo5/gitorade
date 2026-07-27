import { useState, type ReactNode } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import logo from "../assets/brand/logo.png";

const FEEDBACK_REPO = "https://github.com/htaraujo5/gitorade/issues/new";

export function FeedbackModal({ onClose }: { onClose: () => void }) {
  const [brief, setBrief] = useState("");
  const [details, setDetails] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const canSend = brief.trim().length > 0;

  const send = async () => {
    if (!canSend || busy) return;
    setBusy(true);
    const body = [
      details.trim() || "_Sem detalhes._",
      "",
      "---",
      email.trim() ? `Contato: ${email.trim()}` : null,
      `Platform: ${navigator.platform}`,
    ]
      .filter(Boolean)
      .join("\n");
    const url =
      `${FEEDBACK_REPO}?title=${encodeURIComponent(brief.trim())}` +
      `&body=${encodeURIComponent(body)}`;
    try {
      await openUrl(url);
      onClose();
    } catch {
      window.open(url, "_blank");
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg border border-[#3a3f4b] bg-[#1c1f26] shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-[#2d3139] px-4 py-3">
          <img src={logo} alt="" className="mt-0.5 h-8 w-8 object-contain" />
          <div className="min-w-0 flex-1">
            <h2 id="feedback-title" className="text-[15px] font-semibold text-[#f0f1f4]">
              Feedback
            </h2>
            <p className="mt-0.5 text-[12px] text-[#8b909a]">
              Conte um problema ou uma ideia de recurso que você gostaria de ter.
            </p>
          </div>
          <button
            type="button"
            className="rounded px-1.5 text-[16px] leading-none text-[#6b7280] hover:bg-[#252830] hover:text-[#e8eaed]"
            onClick={onClose}
            aria-label="Fechar"
          >
            ×
          </button>
        </div>
        <div className="space-y-3 px-4 py-3">
          <Field label="Descrição breve">
            <input
              autoFocus
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="Qual o problema ou a ideia?"
              className="h-9 w-full rounded border border-[#3a3f4b] bg-[#12141a] px-3 text-[13px] text-[#f0f1f4] outline-none placeholder:text-[#5c6370] focus:border-[#a371f7]"
            />
          </Field>
          <Field label="Detalhes">
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={5}
              placeholder="Descreva o problema e como reproduzir, ou detalhe a sugestão."
              className="w-full resize-y rounded border border-[#3a3f4b] bg-[#12141a] px-3 py-2 text-[13px] text-[#f0f1f4] outline-none placeholder:text-[#5c6370] focus:border-[#a371f7]"
            />
          </Field>
          <Field label="E-mail (opcional)">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@servidor.com"
              className="h-9 w-full rounded border border-[#3a3f4b] bg-[#12141a] px-3 text-[13px] text-[#f0f1f4] outline-none placeholder:text-[#5c6370] focus:border-[#a371f7]"
            />
          </Field>
        </div>
        <div className="flex justify-end gap-2 border-t border-[#2d3139] px-4 py-2.5">
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded border border-[#3a3f4b] px-4 text-[12px] text-[#c8ccd4] hover:bg-[#252830]"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!canSend || busy}
            onClick={() => void send()}
            className="h-8 rounded border border-[#a371f7] bg-[#a371f7]/20 px-4 text-[12px] font-medium text-[#e8eaed] hover:bg-[#a371f7]/30 disabled:opacity-40"
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-[11px] font-medium text-[#8b909a]">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}
