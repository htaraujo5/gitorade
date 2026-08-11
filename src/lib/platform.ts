/** True when running as a macOS Tauri webview (or Safari-like UA). */
export function isMacOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const platform = navigator.platform || "";
  const ua = navigator.userAgent || "";
  return platform === "MacIntel" || platform === "MacPPC" || /Mac OS X|Macintosh/.test(ua);
}
