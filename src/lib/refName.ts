/** Mirrors the most common `git check-ref-format` rules. Returns an error message or null. */
export function validateRefName(raw: string): string | null {
  const name = raw.trim();
  if (!name) return "Informe um nome.";
  if (/\s/.test(name)) return "Não use espaços.";
  if (name.startsWith("-")) return "Não pode começar com '-'.";
  if (name.startsWith("/") || name.endsWith("/")) return "Não pode começar ou terminar com '/'.";
  if (name.endsWith(".") || name.endsWith(".lock")) return "Não pode terminar com '.' ou '.lock'.";
  if (name.includes("..") || name.includes("//") || name.includes("@{")) {
    return "Não use '..', '//' ou '@{'.";
  }
  if (/[~^:?*[\\]/.test(name) || [...name].some((c) => c.charCodeAt(0) < 0x20 || c === "\x7f")) {
    return "Caracteres inválidos (~ ^ : ? * [ \\).";
  }
  if (name === "@" || name === "HEAD") return "Nome reservado.";
  return null;
}
