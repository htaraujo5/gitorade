import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AppPrefs = {
  language: "pt-BR" | "en";
  relativeDates: boolean;
  showAvatars: boolean;
  confirmDangerous: boolean;
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
  setPref: <K extends keyof AppPrefs>(key: K, value: AppPrefs[K]) => void;
  resetPrefs: () => void;
};

export const usePrefsStore = create<PrefsState>()(
  persist(
    (set) => ({
      ...defaults,
      setPref: (key, value) => set({ [key]: value } as Partial<AppPrefs>),
      resetPrefs: () =>
        set((s) => ({
          ...defaults,
          onboardingComplete: s.onboardingComplete,
          projectsPath: s.projectsPath,
        })),
    }),
    { name: "gitorade-prefs" },
  ),
);
