/** Client-side mirror of backend path_guard (defense in depth before openPath). */
export function isSafeRepoRelativePath(rel: string): boolean {
  const path = rel.trim();
  if (!path || path.includes("\0")) return false;
  if (path.startsWith("/") || path.startsWith("\\")) return false;
  if (/^[a-zA-Z]:/.test(path)) return false;
  if (path.startsWith("\\\\") || path.startsWith("//")) return false;
  const parts = path.replace(/\\/g, "/").split("/");
  return parts.every((p) => p !== ".." && p !== "");
}
