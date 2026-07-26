import logo from "../assets/brand/logo.png";
import brand from "../assets/brand/brand.png";

type BrandMarkProps = {
  compact?: boolean;
  /** Use full brand lockup (logo + wordmark image) */
  lockup?: boolean;
};

export function BrandMark({ compact = false, lockup = false }: BrandMarkProps) {
  if (lockup) {
    return (
      <img
        src={brand}
        alt="gitorade"
        className="h-10 w-auto object-contain"
      />
    );
  }

  return (
    <div className="flex items-center gap-2.5">
      <img
        src={logo}
        alt=""
        className={compact ? "h-7 w-7 object-contain" : "h-8 w-8 object-contain"}
        aria-hidden
      />
      {!compact && (
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-tight">gitorade</div>
          <div className="text-[11px] text-text-muted">Seu Git. Seu fluxo. Seu jeito.</div>
        </div>
      )}
    </div>
  );
}
