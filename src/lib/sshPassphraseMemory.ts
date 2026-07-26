/** In-memory SSH passphrase cache for the app session (never written to disk). */

type Entry = {
  passphrase: string;
  /** When true, auto-answer askpass without showing the UI. */
  dontAskAgain: boolean;
};

const byKey = new Map<string, Entry>();

export function extractSshKeyFromPrompt(prompt: string): string {
  const match = prompt.match(/['"]([^'"]+)['"]/);
  return match?.[1]?.trim() || prompt.trim() || "default";
}

export function getCachedPassphrase(keyId: string): string {
  return byKey.get(keyId)?.passphrase ?? "";
}

export function shouldSkipAskpass(keyId: string): string | null {
  const e = byKey.get(keyId);
  if (e?.dontAskAgain && e.passphrase) return e.passphrase;
  return null;
}

/** Remember while typing / on confirm. */
export function rememberPassphrase(
  keyId: string,
  passphrase: string,
  dontAskAgain?: boolean,
): void {
  const prev = byKey.get(keyId);
  byKey.set(keyId, {
    passphrase,
    dontAskAgain: dontAskAgain ?? prev?.dontAskAgain ?? false,
  });
}

export function clearPassphraseMemory(keyId?: string): void {
  if (keyId) byKey.delete(keyId);
  else byKey.clear();
}
