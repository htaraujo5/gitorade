import logo from "../assets/brand/logo.png";
import { isMacOS } from "../lib/platform";

/**
 * Boot splash (borderless, dark): animated logo + name + tagline + progress.
 */
export function BootSplash({
  message = "Iniciando…",
  progress = 0.65,
}: {
  message?: string;
  progress?: number;
}) {
  const pct = Math.max(0.08, Math.min(1, progress));
  const mac = isMacOS();

  return (
    <div
      className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[#12141a]"
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      {mac && <div className="h-7 shrink-0" data-tauri-drag-region />}
      <div
        className={`flex min-h-0 flex-1 items-center gap-7 px-9 pb-4 ${mac ? "pt-2" : "pt-6"}`}
      >
        <div className="relative flex h-[88px] w-[88px] shrink-0 items-center justify-center">
          <span className="gk-open-ring absolute inset-0 rounded-full" />
          <img
            src={logo}
            alt=""
            className="gk-open-logo relative z-10 h-[58px] w-[58px] object-contain drop-shadow-[0_0_18px_rgba(160,80,220,0.45)]"
            aria-hidden
          />
        </div>
        <div className="min-w-0">
          <div className="text-[28px] font-semibold leading-none tracking-tight text-[#f0f1f4]">
            Gitorade
          </div>
          <p className="mt-2 text-[13px] leading-snug text-[#8b909a]">
            um cliente Git rápido e amigável para Windows, macOS e Linux
          </p>
        </div>
      </div>
      <div className="h-1.5 w-full bg-[#1c1f26]">
        <div
          className="h-full bg-gradient-to-r from-[#6b5cff] to-[#e040a0] transition-[width] duration-500 ease-out"
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  );
}
