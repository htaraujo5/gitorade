import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "../stores/appStore";

/** Slim yellow strip — conflict details live in the right sidebar. */
export function ConflictBanner() {
  const status = useAppStore((s) => s.status);
  const inProgress = status?.inProgress ?? null;
  const conflicts = useMemo(() => status?.conflicts ?? [], [status?.conflicts]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
  }, [inProgress, conflicts.length]);

  if (dismissed) return null;
  if (!inProgress && conflicts.length === 0) return null;

  const op = label(inProgress);
  const msg =
    conflicts.length > 0
      ? `${conflicts.length} file conflict${conflicts.length === 1 ? "" : "s"} were found when attempting to ${op.toLowerCase()} into ${status?.branch ?? "HEAD"}`
      : `${op} in progress — resolve remaining steps in the side panel`;

  return (
    <div
      className="flex items-center gap-2 border border-[#e3b341]/35 bg-[#e3b341]/12 px-3 py-1.5 text-[12px] text-[#e8c547]"
      role="status"
    >
      <span aria-hidden>⚠</span>
      <span className="min-w-0 flex-1 truncate">{msg}</span>
      <button
        type="button"
        className="shrink-0 px-1 text-[#8b909a] hover:text-[#e8eaed]"
        aria-label="Dismiss"
        onClick={() => setDismissed(true)}
      >
        ×
      </button>
    </div>
  );
}

function label(kind: string | null): string {
  switch (kind) {
    case "merge":
      return "Merge";
    case "rebase":
      return "Rebase";
    case "cherry-pick":
      return "Cherry-pick";
    default:
      return kind ?? "Integrate";
  }
}
