import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AppPrefs = {
  language: "pt-BR" | "en";
  relativeDates: boolean;
  showAvatars: boolean;
  confirmDangerous: boolean;
  enableTerminal: boolean;
  openLastRepoOnStart: boolean;
  graphCommitLimit: number;
  statusPollSeconds: number;
  terminalFontSize: number;
  terminalOpenByDefault: boolean;
  diffLayout: "unified" | "split";
  /** First-run wizard completed */
  onboardingComplete: boolean;
  /** Default folder for open/clone dialogs */
  projectsPath: string;
};

const defaults: AppPrefs = {
  language: "pt-BR",
  relativeDates: true,
  showAvatars: true,
  confirmDangerous: true,
  enableTerminal: true,
  openLastRepoOnStart: false,
  graphCommitLimit: 150,
  statusPollSeconds: 4,
  terminalFontSize: 12,
  terminalOpenByDefault: false,
  diffLayout: "unified",
  onboardingComplete: false,
  projectsPath: "",
};

type PrefsState = AppPrefs & {
  /** Epoch ms of last auto-save; UI flash only (not persisted). */
  prefsSavedAt: number | null;
  setPref: <K extends keyof AppPrefs>(key: K, value: AppPrefs[K]) => void;
  resetPrefs: () => void;
  clearPrefsSaved: () => void;
};

export const usePrefsStore = create<PrefsState>()(
  persist(
    (set) => ({
      ...defaults,
      prefsSavedAt: null,
      setPref: (key, value) =>
        set({ [key]: value, prefsSavedAt: Date.now() } as Partial<PrefsState>),
      resetPrefs: () =>
        set((s) => ({
          ...defaults,
          onboardingComplete: s.onboardingComplete,
          projectsPath: s.projectsPath,
          prefsSavedAt: Date.now(),
        })),
      clearPrefsSaved: () => set({ prefsSavedAt: null }),
    }),
    {
      name: "gitorade-prefs",
      partialize: (state) =>
        Object.fromEntries(
          (Object.keys(defaults) as (keyof AppPrefs)[]).map((key) => [key, state[key]]),
        ) as AppPrefs,
    },
  ),
);
