import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { listen } from "@tauri-apps/api/event";
import "@xterm/xterm/css/xterm.css";
import * as api from "../lib/api";
import { useAppStore } from "../stores/appStore";
import { usePrefsStore } from "../stores/prefsStore";

type TerminalPayload = {
  sessionId: string;
  data: string;
  done: boolean;
};

/** Bottom terminal panel styled like GitKraken (>_ Terminal + xterm). */
export function TerminalPanel() {
  const activeRepoId = useAppStore((s) => s.activeRepoId);
  const setTerminalOpen = useAppStore((s) => s.setTerminalOpen);
  const fontSize = usePrefsStore((s) => s.terminalFontSize);
  const hostRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<string | null>(null);
  const [height, setHeight] = useState(160);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: "bar",
      fontFamily: '"JetBrains Mono", "Cascadia Code", Consolas, monospace',
      fontSize,
      fontWeight: "400",
      lineHeight: 1.25,
      letterSpacing: 0,
      theme: {
        background: "#12141a",
        foreground: "#c4c8d0",
        cursor: "#8b909a",
        cursorAccent: "#12141a",
        selectionBackground: "#3d8bfd44",
        black: "#12141a",
        red: "#f85149",
        green: "#3dd68c",
        yellow: "#e3b341",
        blue: "#3d8bfd",
        magenta: "#a371f7",
        cyan: "#56d4dd",
        white: "#d8dbe2",
        brightBlack: "#6b7280",
        brightRed: "#ff7b72",
        brightGreen: "#56d364",
        brightYellow: "#e3b341",
        brightBlue: "#79c0ff",
        brightMagenta: "#d2a8ff",
        brightCyan: "#56d4dd",
        brightWhite: "#f0f1f4",
      },
      allowProposedApi: true,
      scrollback: 5000,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(hostRef.current);
    requestAnimationFrame(() => fit.fit());

    let unlisten: (() => void) | undefined;
    let disposed = false;

    const boot = async () => {
      const sessionId = await api.terminalCreate(activeRepoId, term.cols, term.rows);
      if (disposed) {
        await api.terminalKill(sessionId);
        return;
      }
      sessionRef.current = sessionId;

      unlisten = await listen<TerminalPayload>("terminal://data", (event) => {
        if (event.payload.sessionId !== sessionRef.current) return;
        if (event.payload.data) term.write(event.payload.data);
        if (event.payload.done) term.writeln("\r\n[sessão encerrada]");
      });

      term.onData((data) => {
        const id = sessionRef.current;
        if (id) void api.terminalWrite(id, data);
      });
    };

    void boot().catch((err) => {
      term.writeln(`\r\nErro ao iniciar terminal: ${String(err)}`);
    });

    const ro = new ResizeObserver(() => {
      fit.fit();
      const id = sessionRef.current;
      if (id) void api.terminalResize(id, term.cols, term.rows);
    });
    ro.observe(hostRef.current);

    return () => {
      disposed = true;
      ro.disconnect();
      unlisten?.();
      const id = sessionRef.current;
      sessionRef.current = null;
      if (id) void api.terminalKill(id);
      term.dispose();
    };
  }, [activeRepoId, fontSize]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = dragRef.current.startY - e.clientY;
      const next = Math.min(360, Math.max(120, dragRef.current.startH + delta));
      setHeight(next);
    };
    const onUp = () => {
      dragRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  return (
    <div
      className="flex shrink-0 flex-col border-t border-[#2d3139] bg-[#12141a]"
      style={{ height }}
    >
      {/* drag handle to resize like Kraken */}
      <div
        role="separator"
        aria-orientation="horizontal"
        className="h-1 shrink-0 cursor-ns-resize bg-transparent hover:bg-[#3d8bfd]/40"
        onMouseDown={(e) => {
          dragRef.current = { startY: e.clientY, startH: height };
          document.body.style.cursor = "ns-resize";
          document.body.style.userSelect = "none";
        }}
      />

      <div className="flex h-7 shrink-0 items-center justify-between border-b border-[#2d3139] bg-[#1c1f26] px-2.5">
        <div className="flex items-center gap-1.5 text-[11px] font-normal tracking-wide text-[#8b909a]">
          <span className="font-mono text-[10px] text-[#6b7280]">&gt;_</span>
          <span>Terminal</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            title="Fechar"
            className="rounded px-1.5 py-0.5 text-[12px] leading-none text-[#6b7280] hover:bg-[#2a2e38] hover:text-[#d8dbe2]"
            onClick={() => setTerminalOpen(false)}
          >
            ×
          </button>
        </div>
      </div>

      <div ref={hostRef} className="gk-term min-h-0 flex-1 overflow-hidden" />
    </div>
  );
}
