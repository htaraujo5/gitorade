import logo from "../assets/brand/logo.png";

/**
 * Fork-like boot splash: logo + name + tagline + “Iniciando…” + progress bar.
 * Shown while prefs hydrate / backend bootstrap.
 */
export function BootSplash({
  message = "Iniciando…",
  progress = 0.65,
}: {
  message?: string;
  progress?: number;
}) {
  const pct = Math.max(0.08, Math.min(1, progress));

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-[#f4f5f7]">
      <div className="flex min-h-0 flex-1 items-center gap-7 px-9 pb-4 pt-6">
        <img
          src={logo}
          alt=""
          className="h-[88px] w-[88px] shrink-0 object-contain"
          aria-hidden
        />
        <div className="min-w-0">
          <div className="text-[28px] font-semibold leading-none tracking-tight text-[#2a2e36]">
            Gitorade
          </div>
          <p className="mt-2 text-[13px] leading-snug text-[#6b7280]">
            um cliente Git rápido e amigável para Windows
          </p>
          <p className="mt-4 text-[13px] font-medium text-[#6b5cff]">{message}</p>
        </div>
      </div>
      <div className="h-1.5 w-full bg-[#e4e6eb]">
        <div
          className="h-full bg-[#7ee787] transition-[width] duration-500 ease-out"
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  );
}
