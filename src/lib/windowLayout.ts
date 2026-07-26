import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";

const SETUP_SIZE = { width: 760, height: 440 };
const APP_SIZE = { width: 1440, height: 900 };
const APP_MIN = { width: 1100, height: 700 };

export async function applySetupWindow(): Promise<void> {
  const win = getCurrentWindow();
  await win.setResizable(false);
  await win.setMinimizable(true);
  await win.setMaximizable(false);
  await win.setMinSize(new LogicalSize(SETUP_SIZE.width, SETUP_SIZE.height));
  await win.setSize(new LogicalSize(SETUP_SIZE.width, SETUP_SIZE.height));
  await win.setTitle("Bem-vindo ao Gitorade");
  await win.center();
}

export async function applyMainWindow(): Promise<void> {
  const win = getCurrentWindow();
  await win.setResizable(true);
  await win.setMaximizable(true);
  await win.setMinSize(new LogicalSize(APP_MIN.width, APP_MIN.height));
  await win.setSize(new LogicalSize(APP_SIZE.width, APP_SIZE.height));
  await win.setTitle("Gitorade");
  await win.center();
}
