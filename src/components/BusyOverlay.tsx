import { useAppStore } from "../stores/appStore";

/**
 * Lightweight busy indicator for local git ops (checkout, create branch, …)
 * that don't use OperationOverlay progress streams.
 */
export function BusyOverlay() {
  const busy = useAppStore((s) => s.busy);
  const busyLabel = useAppStore((s) => s.busyLabel);
  const operation = useAppStore((s) => s.operation);

  if (!busy || operation || !busyLabel) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-40 flex items-start justify-center bg-black/25 pt-[18vh]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="pointer-events-auto flex items-center gap-3 rounded-lg border border-[#3a3f4b] bg-[#1c1f26]/95 px-4 py-3 shadow-2xl shadow-black/40 backdrop-blur-sm">
        <span
          className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[#3d8bfd]/30 border-t-[#3d8bfd]"
          aria-hidden
        />
        <span className="text-[13px] font-medium text-[#e8eaed]">{busyLabel}</span>
      </div>
    </div>
  );
}
