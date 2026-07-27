import { usePrefsStore } from "../stores/prefsStore";

/** Confirm destructive actions when prefs.confirmDangerous is enabled. */
export function requireDangerousConfirm(message: string): boolean {
  if (!usePrefsStore.getState().confirmDangerous) {
    return true;
  }
  return window.confirm(message);
}
