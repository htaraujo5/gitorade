import { useEffect, useState, type ReactNode } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useAppStore, type ShellTab } from "../../stores/appStore";
import logo from "../../assets/brand/logo.png";
import {
  IconBranch,
  IconClose,
  IconDashboard,
  IconKey,
  IconPlus,
  IconRepos,
  IconPlugins,
  IconSettings,
} from "../Icons";
import { MenuBar } from "./MenuBar";
import { ProfileMenu } from "./ProfileMenu";

/**
 * Single Fork-style chrome: title row (menus · brand · window controls)
 * + tab row — one visual block, not stacked separate bars.
 */
export function AppChrome({ onFeedback }: { onFeedback: () => void }) {
  const [maximized, setMaximized] = useState(false);
  const shellTabs = useAppStore((s) => s.shellTabs);
  const activeShellTabId = useAppStore((s) => s.activeShellTabId);
  const activateShellTab = useAppStore((s) => s.activateShellTab);
  const closeShellTab = useAppStore((s) => s.closeShellTab);
  const openStartTab = useAppStore((s) => s.openStartTab);
  const openSettingsTab = useAppStore((s) => s.openSettingsTab);
  const openRepositoryDialog = useAppStore((s) => s.openRepositoryDialog);

  useEffect(() => {
    const win = getCurrentWindow();
    let unlisten: (() => void) | undefined;
    void win.isMaximized().then(setMaximized);
    void win
      .onResized(() => {
        void win.isMaximized().then(setMaximized);
      })
      .then((fn) => {
        unlisten = fn;
      });
    return () => unlisten?.();
  }, []);

  const appWin = () => getCurrentWindow();

  return (
    <header className="shrink-0 border-b border-[#2d3139] bg-[#1a1d24]">
      {/* Title row */}
      <div
        className="grid h-9 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center"
        data-tauri-drag-region
      >
        <div
          className="flex h-full min-w-0 items-center pl-1"
          /* menus must not drag the window */
          onMouseDown={(e) => e.stopPropagation()}
        >
          <MenuBar embedded />
        </div>

        <div className="flex h-full items-center px-3" data-tauri-drag-region>
          <div
            className="pointer-events-none flex select-none items-center gap-1.5"
            data-tauri-drag-region
          >
            <img
              src={logo}
              alt=""
              className="h-4 w-4 object-contain"
              aria-hidden
            />
            <span className="text-[12px] font-semibold tracking-wide text-[#e8eaed]">
              gitorade
            </span>
          </div>
        </div>

        <div
          className="flex h-full items-center justify-end"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <WinBtn title="Feedback" onClick={onFeedback}>
            <IconFeedback className="h-3.5 w-3.5" />
          </WinBtn>
          <WinBtn title="Minimizar" onClick={() => void appWin().minimize()}>
            <svg width="10" height="1" viewBox="0 0 10 1" aria-hidden>
              <rect width="10" height="1" fill="currentColor" />
            </svg>
          </WinBtn>
          <WinBtn
            title={maximized ? "Restaurar" : "Maximizar"}
            onClick={() => void appWin().toggleMaximize()}
          >
            {maximized ? (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
                <path
                  d="M3 1h6v6H8V2H3V1ZM1 3h6v6H1V3Z"
                  stroke="currentColor"
                  strokeWidth="1"
                />
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
                <rect
                  x="1"
                  y="1"
                  width="8"
                  height="8"
                  stroke="currentColor"
                  strokeWidth="1"
                />
              </svg>
            )}
          </WinBtn>
          <WinBtn title="Fechar" danger onClick={() => void appWin().close()}>
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
              <path
                d="M1 1l8 8M9 1L1 9"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
          </WinBtn>
        </div>
      </div>

      {/* Tab row — same chrome, lighter divider */}
      <div className="flex h-8 items-stretch border-t border-[#2d3139]/80 bg-[#161920]">
        <div className="flex min-w-0 flex-1 items-stretch overflow-x-auto pl-1">
          {shellTabs.map((tab) => (
            <ShellTabChip
              key={tab.id}
              tab={tab}
              active={tab.id === activeShellTabId}
              onActivate={() => void activateShellTab(tab.id)}
              onClose={() => closeShellTab(tab.id)}
            />
          ))}
          <button
            type="button"
            title="Nova aba"
            className="flex w-7 shrink-0 items-center justify-center text-[#6b7280] hover:bg-[#1c1f26] hover:text-[#d8dbe2]"
            onClick={() => openStartTab()}
          >
            <IconPlus className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex shrink-0 items-center gap-0.5 border-l border-[#2d3139] px-1">
          <IconBtn
            title="Abrir repositório"
            onClick={() => void openRepositoryDialog()}
          >
            <IconRepos className="h-3.5 w-3.5" />
          </IconBtn>
          <IconBtn title="Preferências" onClick={() => openSettingsTab()}>
            <IconSettings className="h-3.5 w-3.5" />
          </IconBtn>
          <ProfileMenu />
        </div>
      </div>
    </header>
  );
}

function ShellTabChip({
  tab,
  active,
  onActivate,
  onClose,
}: {
  tab: ShellTab;
  active: boolean;
  onActivate: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className={`group flex max-w-[180px] items-stretch ${
        active
          ? "border-b-2 border-[#3d8bfd] bg-[#1c1f26] text-[#e8eaed]"
          : "border-b-2 border-transparent text-[#8b909a] hover:bg-[#1a1d24] hover:text-[#c5c9d2]"
      }`}
    >
      <button
        type="button"
        onClick={onActivate}
        className="flex min-w-0 flex-1 items-center gap-1.5 px-2.5 text-left"
      >
        <TabIcon kind={tab.kind} />
        <span className="min-w-0 truncate text-[11px] font-normal">{tab.title}</span>
      </button>
      <button
        type="button"
        title="Fechar aba"
        className={`flex w-6 shrink-0 items-center justify-center opacity-0 group-hover:opacity-100 ${
          active ? "opacity-70 hover:text-white" : "hover:text-[#e8eaed]"
        }`}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        <IconClose className="h-3 w-3" />
      </button>
    </div>
  );
}

function TabIcon({ kind }: { kind: ShellTab["kind"] }) {
  if (kind === "repo") return <IconBranch className="h-3 w-3 text-[#3dd68c]" />;
  if (kind === "settings") return <IconSettings className="h-3 w-3" />;
  if (kind === "start") return <IconDashboard className="h-3 w-3" />;
  if (kind === "ssh") return <IconKey className="h-3 w-3" />;
  if (kind === "plugins") return <IconPlugins className="h-3 w-3" />;
  return <IconRepos className="h-3 w-3" />;
}

function IconBtn({
  children,
  title,
  onClick,
}: {
  children: ReactNode;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="rounded p-1.5 text-[#8b909a] hover:bg-[#252830] hover:text-[#e8eaed]"
    >
      {children}
    </button>
  );
}

function WinBtn({
  title,
  onClick,
  children,
  danger,
}: {
  title: string;
  onClick: () => void;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`flex h-full w-10 items-center justify-center text-[#9aa0ab] ${
        danger
          ? "hover:bg-[#e81123] hover:text-white"
          : "hover:bg-[#252830] hover:text-[#e8eaed]"
      }`}
    >
      {children}
    </button>
  );
}

function IconFeedback({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M9 10h.01M15 10h.01" />
      <path d="M8.5 14.5c1.1 1.2 2.5 1.8 3.5 1.8s2.4-.6 3.5-1.8" />
    </svg>
  );
}
