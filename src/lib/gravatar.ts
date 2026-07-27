import { md5Hex } from "./md5";

/** Gravatar avatar URL for an email (404 when no custom image — use with onError fallback). */
export function gravatarUrl(email: string, sizePx = 80): string | null {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) return null;
  const hash = md5Hex(normalized);
  const s = Math.max(16, Math.min(512, Math.round(sizePx)));
  return `https://www.gravatar.com/avatar/${hash}?s=${s}&d=404&r=g`;
}
