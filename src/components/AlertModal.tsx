import type { ReactNode } from "react";

/**
 * Modal for errors / explanations only (no success toasts — the UI already updates).
 */
export function AlertModal({
  title = "Atenção",
  children,
  onClose,
}: {
  title?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="gitorade-alert-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border border-[#3a3f4b] bg-[#1c1f26] shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-[#2d3139] px-4 py-3">
          <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f85149]/20 text-[12px] font-bold text-[#f85149]">
            !
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="gitorade-alert-title" className="text-[14px] font-medium text-[#f0f1f4]">
              {title}
            </h2>
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
        <div className="px-4 py-3 text-[13px] leading-relaxed text-[#c8ccd4]">{children}</div>
        <div className="flex justify-end border-t border-[#2d3139] px-4 py-2.5">
          <button
            type="button"
            className="h-8 min-w-[88px] rounded border border-[#a371f7] bg-[#a371f7]/15 px-4 text-[12px] font-medium text-[#e8eaed] hover:bg-[#a371f7]/25"
            onClick={onClose}
            autoFocus
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
}
