import { useEffect, useRef, type ReactNode } from "react";

export type ContextMenuItem =
  | { type: "item"; label: string; disabled?: boolean; danger?: boolean; onClick: () => void }
  | { type: "separator" };

type Props = {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
};

/** Dark floating menu (GitKraken-style). */
export function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // defer so the opening click doesn't immediately close
    const t = window.setTimeout(() => {
      document.addEventListener("mousedown", onDoc);
      document.addEventListener("keydown", onKey);
      document.addEventListener("scroll", onClose, true);
    }, 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let left = x;
    let top = y;
    if (left + rect.width > window.innerWidth - 8) left = window.innerWidth - rect.width - 8;
    if (top + rect.height > window.innerHeight - 8) top = window.innerHeight - rect.height - 8;
    if (left < 8) left = 8;
    if (top < 8) top = 8;
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }, [x, y, items]);

  return (
    <div
      ref={ref}
      role="menu"
      className="fixed z-[100] min-w-[220px] overflow-hidden rounded-md border border-[#3a3f4b] bg-[#252830] py-1 shadow-2xl shadow-black/50"
      style={{ left: x, top: y }}
    >
      {items.map((item, i) => {
        if (item.type === "separator") {
          return <div key={`sep-${i}`} className="my-1 border-t border-[#3a3f4b]" />;
        }
        return (
          <button
            key={`${item.label}-${i}`}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            className={`flex w-full items-center px-3 py-1.5 text-left text-[12px] disabled:cursor-not-allowed disabled:opacity-35 ${
              item.danger
                ? "text-[#f85149] hover:bg-[#3a1f24]"
                : "text-[#e8eaed] hover:bg-[#2f3440]"
            }`}
            onClick={() => {
              if (item.disabled) return;
              item.onClick();
              onClose();
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export function ToastBanner({
  kind,
  children,
  onClose,
}: {
  kind: "error" | "success";
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className={`flex items-start gap-2 border-b px-3 py-2 text-[11px] leading-snug ${
        kind === "error"
          ? "border-[#f85149]/25 bg-[#2a1518] text-[#ffb4b0]"
          : "border-[#3dd68c]/25 bg-[#12241a] text-[#9be9b0]"
      }`}
    >
      <span
        className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
          kind === "error" ? "bg-[#f85149]/30 text-[#f85149]" : "bg-[#3dd68c]/25 text-[#3dd68c]"
        }`}
      >
        {kind === "error" ? "!" : "✓"}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
      <button
        type="button"
        onClick={onClose}
        className="shrink-0 text-[10px] opacity-70 hover:opacity-100"
      >
        Fechar
      </button>
    </div>
  );
}
