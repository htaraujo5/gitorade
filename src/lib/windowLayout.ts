import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";

const SPLASH_SIZE = { width: 520, height: 220 };
const SETUP_SIZE = { width: 720, height: 460 };
const APP_SIZE = { width: 1440, height: 900 };
const APP_MIN = { width: 1100, height: 700 };

async function safe(label: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    console.warn(`[windowLayout] ${label}:`, err);
  }
}

export async function applySplashWindow(): Promise<void> {
  const win = getCurrentWindow();
  await safe("decorations", () => win.setDecorations(false));
  await safe("resizable", () => win.setResizable(false));
  await safe("maximizable", () => win.setMaximizable(false));
  await safe("minimizable", () => win.setMinimizable(false));
  await safe("minSize", () => win.setMinSize(new LogicalSize(400, 180)));
  await safe("size", () =>
    win.setSize(new LogicalSize(SPLASH_SIZE.width, SPLASH_SIZE.height)),
  );
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
  await safe("minSize", () =>
    win.setMinSize(new LogicalSize(SETUP_SIZE.width, SETUP_SIZE.height)),
  );
  await safe("size", () =>
    win.setSize(new LogicalSize(SETUP_SIZE.width, SETUP_SIZE.height)),
  );
  await safe("title", () => win.setTitle("Bem-vindo ao Gitorade"));
  await safe("center", () => win.center());
}

export async function applyMainWindow(): Promise<void> {
  const win = getCurrentWindow();

  // Custom AppChrome — OS title bar must stay OFF
  await safe("decorations", () => win.setDecorations(false));
  await safe("resizable", () => win.setResizable(true));
  await safe("maximizable", () => win.setMaximizable(true));
  await safe("minimizable", () => win.setMinimizable(true));
  await safe("closable", () => win.setClosable(true));

  await safe("minSize-clear", () => win.setMinSize(null));
  await safe("size", () =>
    win.setSize(new LogicalSize(APP_SIZE.width, APP_SIZE.height)),
  );
  await safe("minSize", () =>
    win.setMinSize(new LogicalSize(APP_MIN.width, APP_MIN.height)),
  );
  await safe("title", () => win.setTitle("Gitorade"));
  await safe("center", () => win.center());
  await safe("focus", () => win.setFocus());

  window.setTimeout(() => {
    void (async () => {
      await safe("decorations-retry", () => win.setDecorations(false));
      await safe("size-retry", () =>
        win.setSize(new LogicalSize(APP_SIZE.width, APP_SIZE.height)),
      );
      await safe("center-retry", () => win.center());
    })();
  }, 80);
}
