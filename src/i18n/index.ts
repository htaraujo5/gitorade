import { useCallback } from "react";
import { usePrefsStore } from "../stores/prefsStore";
import { catalogs, type Locale, type MessageKey } from "./messages";

export type { Locale, MessageKey };

export function translate(
  locale: Locale,
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  const table = catalogs[locale] ?? catalogs["pt-BR"];
  let text = table[key] ?? catalogs["pt-BR"][key] ?? String(key);
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.split(`{${k}}`).join(String(v));
    }
  }
  return text;
}

/** Hook: re-renders when prefs.language changes. */
export function useT() {
  const locale = usePrefsStore((s) => s.language);
  return useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale],
  );
}

export function useLocale(): Locale {
  return usePrefsStore((s) => s.language);
}

/** BCP 47 tag for Date#toLocaleString / toLocaleDateString. */
export function dateLocale(locale: Locale): string {
  return locale === "en" ? "en-US" : "pt-BR";
}
