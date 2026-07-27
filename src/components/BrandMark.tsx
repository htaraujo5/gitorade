import logo from "../assets/brand/logo.png";
import brand from "../assets/brand/brand.png";

type BrandMarkProps = {
  compact?: boolean;
  /** Use full brand lockup (logo + wordmark image) */
  lockup?: boolean;
};

export function BrandMark({ compact = false, lockup = false }: BrandMarkProps) {
  if (lockup) {
    return <img src={brand} alt="gitorade" className="h-12 w-auto object-contain" />;
  }

  return (
    <div className="flex items-center gap-3">
      <img
        src={logo}
        alt=""
        className={compact ? "h-11 w-11 object-contain" : "h-14 w-14 object-contain"}
        aria-hidden
      />
      <div className="leading-tight">
        <div
          className={
            compact
              ? "text-[16px] font-semibold tracking-tight text-[#f0f1f4]"
              : "text-lg font-semibold tracking-tight text-[#f0f1f4]"
          }
        >
          gitorade
        </div>
        {!compact && (
          <div className="text-[11px] text-[#6b7280]">Seu Git. Seu fluxo. Seu jeito.</div>
        )}
      </div>
    </div>
  );
}
