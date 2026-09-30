import { create } from "zustand";
import { listen } from "@tauri-apps/api/event";
import * as api from "../lib/api";
import type { UpdateInfo, UpdateProgress } from "../lib/api";
import { usePrefsStore } from "./prefsStore";

type Phase = "idle" | "checking" | "downloading" | "installing" | "manual" | "error";

type UpdateState = {
  info: UpdateInfo | null;
  phase: Phase;
  progress: UpdateProgress | null;
  error: string | null;
  /** Update prompt visible */
  modalOpen: boolean;
  lastCheckedAt: number | null;
  /** Silent startup check: opens the modal only if a new, non-skipped version exists. */
  checkOnStartup: () => Promise<void>;
  /** Manual check (Settings/menu): always opens the modal with the result. */
  checkNow: () => Promise<void>;
  install: () => Promise<void>;
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
  lastCheckedAt: null,

  checkOnStartup: async () => {
    if (import.meta.env.DEV) return;
    if (!usePrefsStore.getState().autoCheckUpdates) return;
    if (get().phase !== "idle") return;
    try {
      const info = await api.checkForUpdate();
      set({ info, lastCheckedAt: Date.now() });
      const skipped = usePrefsStore.getState().skippedUpdateVersion;
      if (info.available && info.latestVersion !== skipped) set({ modalOpen: true });
    } catch {
      // Offline or rate-limited on boot: stay quiet, the user can check manually.
    }
  },

  checkNow: async () => {
    if (get().phase === "downloading" || get().phase === "installing") {
      set({ modalOpen: true });
      return;
    }
    set({ phase: "checking", error: null, modalOpen: true });
    try {
      const info = await api.checkForUpdate();
      set({ info, phase: "idle", lastCheckedAt: Date.now() });
    } catch (err) {
      set({ phase: "error", error: errMsg(err) });
    }
  },

  install: async () => {
    ensureProgressListener(set);
    set({ phase: "downloading", progress: null, error: null, modalOpen: true });
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

  skipVersion: () => {
    const v = get().info?.latestVersion;
    if (v) usePrefsStore.getState().setPref("skippedUpdateVersion", v);
    set({ modalOpen: false });
  },

  closeModal: () => {
    const phase = get().phase;
    if (phase === "downloading" || phase === "installing") return;
    set({ modalOpen: false, phase: phase === "error" || phase === "manual" ? "idle" : phase });
  },
}));
