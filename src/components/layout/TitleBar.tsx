import { useEffect, useState, type ReactNode } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import logo from "../../assets/brand/logo.png";
import { MenuBar } from "./MenuBar";

/**
 * Fork-style chrome: menus · centered brand · feedback + window controls.
 */
export function TitleBar({ onFeedback }: { onFeedback: () => void }) {
  const [maximized, setMaximized] = useState(false);

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
    <div className="grid h-10 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-[#2d3139] bg-[#1a1d24]">
      {/* Left — menus */}
      <div className="flex h-full min-w-0 items-center overflow-hidden pl-0.5">
        <MenuBar embedded />
        <div className="h-full min-w-2 flex-1" data-tauri-drag-region />
      </div>

      {/* Center — logo + name, no box */}
      <div className="flex h-full items-center px-2" data-tauri-drag-region>
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

      {/* Right — feedback + window controls */}
      <div className="flex h-full items-center justify-end">
        <div className="h-full min-w-2 flex-1" data-tauri-drag-region />
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
              <rect x="1" y="1" width="8" height="8" stroke="currentColor" strokeWidth="1" />
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
