import { useEffect, useState } from "react";
import { useAppStore, type CheckoutDirtyMode } from "../stores/appStore";
import { IconBranch } from "./Icons";
import logo from "../assets/brand/logo.png";

const OPTIONS: {
  id: CheckoutDirtyMode;
  label: string;
}[] = [
  { id: "keep", label: "Don't change" },
  { id: "stash", label: "Stash and reapply" },
  { id: "discard", label: "Discard" },
];

/**
 * Checkout dialog matching Fork: radio choices + Checkout / Cancel.
 */
export function CheckoutBranchModal() {
  const prompt = useAppStore((s) => s.checkoutPrompt);
  const busy = useAppStore((s) => s.busy);
  const confirmCheckout = useAppStore((s) => s.confirmCheckout);
  const cancelCheckoutPrompt = useAppStore((s) => s.cancelCheckoutPrompt);
  const [mode, setMode] = useState<CheckoutDirtyMode>("keep");

  useEffect(() => {
    if (prompt) setMode("keep");
  }, [prompt]);

  if (!prompt) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-branch-title"
    >
      <div className="w-full max-w-[420px] rounded-xl border border-[#3a3f4b] bg-[#252830] shadow-2xl shadow-black/60">
        {/* Header — logo + title + close */}
        <div className="flex items-start gap-3 px-5 pb-1 pt-4">
          <img
            src={logo}
            alt=""
            className="mt-0.5 h-11 w-11 shrink-0 object-contain"
          />
          <div className="min-w-0 flex-1 pt-0.5">
            <h2
              id="checkout-branch-title"
              className="text-[16px] font-semibold leading-tight text-[#f0f1f4]"
            >
              Checkout Branch
            </h2>
            <p className="mt-0.5 text-[12px] text-[#8b909a]">
              Switch to another branch
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={cancelCheckoutPrompt}
            className="rounded p-1 text-[16px] leading-none text-[#6b7280] hover:bg-[#2f3440] hover:text-[#e8eaed]"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {/* Switch to */}
          <div className="flex items-center gap-2 text-[13px]">
            <span className="w-[7.5rem] shrink-0 text-[#8b909a]">Switch to:</span>
            <span className="inline-flex min-w-0 items-center gap-1.5 text-[#e8eaed]">
              <IconBranch className="h-3.5 w-3.5 shrink-0 text-[#8b909a]" />
              <span className="truncate font-medium">{prompt.target}</span>
            </span>
          </div>

          {/* Local changes radios */}
          <div className="flex gap-2 text-[13px]">
            <span className="w-[7.5rem] shrink-0 pt-0.5 text-[#8b909a]">
              Local changes:
            </span>
            <div
              className="flex flex-col gap-2"
              role="radiogroup"
              aria-label="Local changes"
            >
              {OPTIONS.map((opt) => (
                <label
                  key={opt.id}
                  className="flex cursor-pointer items-center gap-2 text-[#d0d4dc]"
                >
                  <input
                    type="radio"
                    name="checkout-local-changes"
                    checked={mode === opt.id}
                    disabled={busy}
                    onChange={() => setMode(opt.id)}
                    className="h-3.5 w-3.5 accent-[#3d8bfd]"
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {prompt.changeCount > 0 && (
            <p className="pl-[7.5rem] text-[11px] text-[#6b7280]">
              {prompt.changeCount} alteração(ões) no working tree
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 pb-4 pt-1">
          <button
            type="button"
            disabled={busy}
            onClick={() => void confirmCheckout(mode)}
            className="h-8 min-w-[88px] rounded-md bg-[#3d8bfd] px-4 text-[12px] font-medium text-white hover:bg-[#4b93ff] disabled:opacity-40"
          >
            Checkout
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={cancelCheckoutPrompt}
            className="h-8 min-w-[88px] rounded-md border border-[#3a3f4b] bg-[#2a2e38] px-4 text-[12px] text-[#d0d4dc] hover:bg-[#323640] disabled:opacity-40"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
