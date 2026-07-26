import logo from "../assets/brand/logo.png";

/** GitKraken-style centered overlay while a repository is loading. */
export function OpeningRepoOverlay({ name }: { name: string }) {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[200] flex items-center justify-center bg-[#0e1014]/72 backdrop-blur-[2px]"
      role="status"
      aria-live="polite"
      aria-label={`Abrindo ${name}`}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="relative flex h-[88px] w-[88px] items-center justify-center">
          <span className="gk-open-ring absolute inset-0 rounded-full" />
          <img
            src={logo}
            alt=""
            className="gk-open-logo relative z-10 h-12 w-12 object-contain drop-shadow-[0_0_18px_rgba(160,80,220,0.45)]"
            aria-hidden
          />
        </div>
        <p className="text-[14px] font-normal tracking-wide text-[#e8eaed]">
          Opening repo
          {name ? (
            <span className="text-[#8b909a]"> · {name}</span>
          ) : null}
        </p>
      </div>
    </div>
  );
}
