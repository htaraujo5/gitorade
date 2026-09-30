import { usePrefsStore } from "../stores/prefsStore";
import { confirmDialog } from "../stores/dialogStore";

/** Confirm destructive actions when prefs.confirmDangerous is enabled. */
export async function requireDangerousConfirm(
  message: string,
  opts?: { title?: string; confirmLabel?: string; force?: boolean },
): Promise<boolean> {
  if (!opts?.force && !usePrefsStore.getState().confirmDangerous) {
    return true;
  }
  return confirmDialog({
    title: opts?.title ?? "Confirmar ação",
    message,
    confirmLabel: opts?.confirmLabel ?? "Confirmar",
    danger: true,
  });
}
