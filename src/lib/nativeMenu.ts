import { useEffect } from "react";
import { Menu, MenuItem, PredefinedMenuItem, Submenu } from "@tauri-apps/api/menu";
import { useAppStore } from "../stores/appStore";
import { usePrefsStore } from "../stores/prefsStore";
import { translate, useLocale } from "../i18n";
import { isMacOS } from "./platform";

/**
 * Installs Arquivo / Editar / Exibir / Ajuda into the macOS system menu bar.
 * No-op on Windows/Linux (in-window MenuBar stays).
 */
export function useNativeAppMenu(enabled: boolean): void {
  const locale = useLocale();
  const enableTerminal = usePrefsStore((s) => s.enableTerminal);
  const hasRepo = useAppStore((s) => Boolean(s.activeRepoId));
  const busy = useAppStore((s) => s.busy);
  const terminalOpen = useAppStore((s) => s.terminalOpen);

  useEffect(() => {
    if (!enabled || !isMacOS()) return;

    let cancelled = false;

    const run = async () => {
      const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
      const store = () => useAppStore.getState();

      const item = (
        id: string,
        text: string,
        opts?: { accelerator?: string; enabled?: boolean; action?: () => void },
      ) =>
        MenuItem.new({
          id,
          text,
          accelerator: opts?.accelerator,
          enabled: opts?.enabled ?? true,
          action: () => opts?.action?.(),
        });

      const file = await Submenu.new({
        text: t("menu.file"),
        items: [
          await item("menu-open-repo", t("menu.openRepo"), {
            accelerator: "CmdOrCtrl+P",
            action: () => void store().openRepositoryDialog(),
          }),
          await item("menu-new-repo", t("menu.newRepo"), {
            action: () => void store().initRepositoryDialog(),
          }),
          await PredefinedMenuItem.new({ item: "Separator" }),
          await item("menu-start", t("menu.start"), {
            action: () => store().openStartTab(),
          }),
          await item("menu-credentials", t("menu.credentials"), {
            action: () => store().openCredentialsTab(),
          }),
          await item("menu-preferences", t("menu.preferences"), {
            accelerator: "CmdOrCtrl+,",
            action: () => store().openSettingsTab(),
          }),
        ],
      });

      const edit = await Submenu.new({
        text: t("menu.edit"),
        items: [
          await PredefinedMenuItem.new({ item: "Undo" }),
          await PredefinedMenuItem.new({ item: "Redo" }),
          await PredefinedMenuItem.new({ item: "Separator" }),
          await PredefinedMenuItem.new({ item: "Cut" }),
          await PredefinedMenuItem.new({ item: "Copy" }),
          await PredefinedMenuItem.new({ item: "Paste" }),
          await PredefinedMenuItem.new({ item: "SelectAll" }),
          await PredefinedMenuItem.new({ item: "Separator" }),
          await item("menu-search", t("menu.searchCommits"), {
            enabled: hasRepo,
            action: () => store().setCommitSearchOpen(true),
          }),
          await item("menu-commit", t("menu.commit"), {
            accelerator: "CmdOrCtrl+Enter",
            enabled: hasRepo && !busy,
            action: () => void store().commit(),
          }),
        ],
      });

      const view = await Submenu.new({
        text: t("menu.view"),
        items: [
          await item(
            "menu-terminal",
            terminalOpen ? t("menu.hideTerminal") : t("menu.showTerminal"),
            {
              accelerator: "CmdOrCtrl+`",
              enabled: hasRepo && enableTerminal,
              action: () => store().setTerminalOpen(!store().terminalOpen),
            },
          ),
          await PredefinedMenuItem.new({ item: "Separator" }),
          await item("menu-fetch", t("header.fetch"), {
            enabled: hasRepo && !busy,
            action: () => void store().fetch(),
          }),
          await item("menu-pull", t("header.pull"), {
            enabled: hasRepo && !busy,
            action: () => void store().pull(),
          }),
          await item("menu-push", t("header.push"), {
            enabled: hasRepo && !busy,
            action: () => void store().push(),
          }),
        ],
      });

      const windowMenu = await Submenu.new({
        text: locale === "en" ? "Window" : "Janela",
        items: [
          await PredefinedMenuItem.new({ item: "Minimize" }),
          await PredefinedMenuItem.new({ item: "Maximize" }),
          await PredefinedMenuItem.new({ item: "Separator" }),
          await PredefinedMenuItem.new({ item: "CloseWindow" }),
        ],
      });

      const help = await Submenu.new({
        text: t("menu.help"),
        items: [
          await item("menu-about", t("menu.about"), {
            action: () => store().openAboutTab(),
          }),
        ],
      });

      const menu = await Menu.new({ items: [file, edit, view, windowMenu, help] });
      if (cancelled) return;
      await menu.setAsAppMenu();
      try {
        await windowMenu.setAsWindowsMenuForNSApp();
      } catch {
        /* older runtimes */
      }
      try {
        await help.setAsHelpMenuForNSApp();
      } catch {
        /* older runtimes */
      }
    };

    void run().catch((err) => {
      console.warn("[nativeMenu]", err);
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, locale, enableTerminal, hasRepo, busy, terminalOpen]);
}
