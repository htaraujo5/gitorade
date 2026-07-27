import {
  currentMonitor,
  getCurrentWindow,
  LogicalSize,
  primaryMonitor,
  type Monitor,
} from "@tauri-apps/api/window";

const SPLASH_SIZE = { width: 520, height: 220 };
const SETUP_SIZE = { width: 720, height: 460 };
/** Comfortable windowed default — not near full-screen. */
const APP_SIZE = { width: 1180, height: 740 };
const APP_MIN = { width: 960, height: 620 };
/** Keep a visible margin around the window so the title bar reads as a window. */
const SCREEN_FIT = 0.78;

async function safe(label: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    console.warn(`[windowLayout] ${label}:`, err);
  }
}

function logicalMonitorSize(monitor: Monitor): { width: number; height: number } {
  const scale = monitor.scaleFactor || 1;
  return {
    width: monitor.size.width / scale,
    height: monitor.size.height / scale,
  };
}

async function resolveMainSize(): Promise<{ width: number; height: number }> {
  try {
    const monitor = (await currentMonitor()) ?? (await primaryMonitor());
    if (monitor) {
      const { width: sw, height: sh } = logicalMonitorSize(monitor);
      return {
        width: Math.min(APP_SIZE.width, Math.max(APP_MIN.width, Math.floor(sw * SCREEN_FIT))),
        height: Math.min(APP_SIZE.height, Math.max(APP_MIN.height, Math.floor(sh * SCREEN_FIT))),
      };
    }
  } catch {
    /* fall through */
  }
  return { ...APP_SIZE };
}

export async function applySplashWindow(): Promise<void> {
  const win = getCurrentWindow();
  await safe("decorations", () => win.setDecorations(false));
  await safe("resizable", () => win.setResizable(false));
  await safe("maximizable", () => win.setMaximizable(false));
  await safe("minimizable", () => win.setMinimizable(false));
  await safe("minSize", () => win.setMinSize(new LogicalSize(400, 180)));
  await safe("size", () => win.setSize(new LogicalSize(SPLASH_SIZE.width, SPLASH_SIZE.height)));
  await safe("title", () => win.setTitle("Gitorade"));
  await safe("center", () => win.center());
}

export async function applySetupWindow(): Promise<void> {
  const win = getCurrentWindow();
  await safe("decorations", () => win.setDecorations(false));
  await safe("resizable", () => win.setResizable(false));
  await safe("minimizable", () => win.setMinimizable(true));
  await safe("maximizable", () => win.setMaximizable(false));
  await safe("closable", () => win.setClosable(true));
  await safe("minSize", () => win.setMinSize(new LogicalSize(SETUP_SIZE.width, SETUP_SIZE.height)));
  await safe("size", () => win.setSize(new LogicalSize(SETUP_SIZE.width, SETUP_SIZE.height)));
  await safe("title", () => win.setTitle("Bem-vindo ao Gitorade"));
  await safe("center", () => win.center());
}

export async function applyMainWindow(): Promise<void> {
  const win = getCurrentWindow();
  const size = await resolveMainSize();

  // Custom AppChrome — OS title bar must stay OFF
  await safe("decorations", () => win.setDecorations(false));
  await safe("unmaximize", () => win.unmaximize());
  await safe("resizable", () => win.setResizable(true));
  await safe("maximizable", () => win.setMaximizable(true));
  await safe("minimizable", () => win.setMinimizable(true));
  await safe("closable", () => win.setClosable(true));

  await safe("minSize-clear", () => win.setMinSize(null));
  await safe("size", () => win.setSize(new LogicalSize(size.width, size.height)));
  await safe("minSize", () => win.setMinSize(new LogicalSize(APP_MIN.width, APP_MIN.height)));
  await safe("title", () => win.setTitle("Gitorade"));
  await safe("center", () => win.center());
  await safe("focus", () => win.setFocus());

  window.setTimeout(() => {
    void (async () => {
      await safe("decorations-retry", () => win.setDecorations(false));
      await safe("unmaximize-retry", () => win.unmaximize());
      await safe("size-retry", () => win.setSize(new LogicalSize(size.width, size.height)));
      await safe("center-retry", () => win.center());
    })();
  }, 80);
}
