import { create } from "zustand";
import { listen } from "@tauri-apps/api/event";
import * as api from "../lib/api";
import type { UpdateInfo, UpdateProgress } from "../lib/api";
import { usePrefsStore } from "./prefsStore";

type Phase = "idle" | "checking" | "downloading" | "installing" | "manual" | "error";

/** How often a running app looks for a new release. */
export const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

type UpdateState = {
  info: UpdateInfo | null;
  phase: Phase;
  progress: UpdateProgress | null;
  error: string | null;
  /** Update prompt visible */
  modalOpen: boolean;
  /** Non-blocking "new version" notice visible */
  bannerOpen: boolean;
  /** Version whose notice was closed this session (not persisted, unlike "skip"). */
  dismissedVersion: string | null;
  lastCheckedAt: number | null;
  /** Silent check (startup + interval): shows the notice only for a new, non-skipped version. */
  checkInBackground: () => Promise<void>;
  /** Manual check (Settings/menu): always opens the modal with the result. */
  checkNow: () => Promise<void>;
  /** Primary action: App Center for snap installs, in-app install otherwise. */
  update: () => Promise<void>;
  install: () => Promise<void>;
  openStore: () => Promise<void>;
  openDetails: () => void;
  dismissBanner: () => void;
  skipVersion: () => void;
  closeModal: () => void;
};

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

let progressListening = false;

function ensureProgressListener(set: (p: Partial<UpdateState>) => void) {
  if (progressListening) return;
  progressListening = true;
  void listen("update://progress", (event) => {
    const parsed = api.updateProgressSchema.safeParse(event.payload);
    if (!parsed.success) return;
    set({
      progress: parsed.data,
      phase: parsed.data.stage === "install" ? "installing" : "downloading",
    });
  }).catch(() => {
    progressListening = false;
  });
}

export const useUpdateStore = create<UpdateState>((set, get) => ({
  info: null,
  phase: "idle",
  progress: null,
  error: null,
  modalOpen: false,
  bannerOpen: false,
  dismissedVersion: null,
  lastCheckedAt: null,

  checkInBackground: async () => {
    if (import.meta.env.DEV) return;
    if (!usePrefsStore.getState().autoCheckUpdates) return;
    if (get().phase !== "idle" || get().modalOpen) return;
    try {
      const info = await api.checkForUpdate();
      set({ info, lastCheckedAt: Date.now() });
      const { skippedUpdateVersion } = usePrefsStore.getState();
      const v = info.latestVersion;
      if (info.available && v !== skippedUpdateVersion && v !== get().dismissedVersion) {
        set({ bannerOpen: true });
      }
    } catch {
      // Offline or rate-limited: stay quiet, the next interval or a manual check retries.
    }
  },

  checkNow: async () => {
    if (get().phase === "downloading" || get().phase === "installing") {
      set({ modalOpen: true });
      return;
    }
    set({ phase: "checking", error: null, modalOpen: true, bannerOpen: false });
    try {
      const info = await api.checkForUpdate();
      set({ info, phase: "idle", lastCheckedAt: Date.now() });
    } catch (err) {
      set({ phase: "error", error: errMsg(err) });
    }
  },

  update: async () => {
    const info = get().info;
    if (info?.managedBy === "snap") return get().openStore();
    if (info?.assetName) return get().install();
    get().openDetails();
  },

  install: async () => {
    ensureProgressListener(set);
    set({ phase: "downloading", progress: null, error: null, modalOpen: true, bannerOpen: false });
    try {
      const next = await api.installUpdate();
      if (next === "restart") {
        set({ phase: "installing" });
        await api.relaunchApp();
      } else if (next === "exit") {
        set({ phase: "installing" });
        await api.exitApp();
      } else {
        set({ phase: "manual" });
      }
    } catch (err) {
      set({ phase: "error", error: errMsg(err) });
    }
  },

  openStore: async () => {
    set({ bannerOpen: false });
    try {
      await api.openUpdateStore();
    } catch (err) {
      set({ phase: "error", error: errMsg(err), modalOpen: true });
    }
  },

  openDetails: () => set({ bannerOpen: false, modalOpen: true }),

  dismissBanner: () =>
    set({ bannerOpen: false, dismissedVersion: get().info?.latestVersion ?? null }),

  skipVersion: () => {
    const v = get().info?.latestVersion;
    if (v) usePrefsStore.getState().setPref("skippedUpdateVersion", v);
    set({ modalOpen: false, bannerOpen: false });
  },

  closeModal: () => {
    const phase = get().phase;
    if (phase === "downloading" || phase === "installing") return;
    const info = get().info;
    set({
      modalOpen: false,
      phase: phase === "error" || phase === "manual" ? "idle" : phase,
      dismissedVersion: info?.available ? info.latestVersion : get().dismissedVersion,
    });
  },
}));
