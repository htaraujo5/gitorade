import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { listen } from "@tauri-apps/api/event";
import "@xterm/xterm/css/xterm.css";
import * as api from "../lib/api";
import { useAppStore } from "../stores/appStore";
import { usePrefsStore } from "../stores/prefsStore";
import { translate, useT } from "../i18n";
import { IconTerminal } from "./Icons";

type TerminalPayload = {
  sessionId: string;
  data: string;
  done: boolean;
};

/** Bottom terminal panel — compact chrome + full-bleed xterm. */
export function TerminalPanel() {
  const t = useT();
  const activeRepoId = useAppStore((s) => s.activeRepoId);
  const repositories = useAppStore((s) => s.repositories);
  const setTerminalOpen = useAppStore((s) => s.setTerminalOpen);
  const fontSize = usePrefsStore((s) => s.terminalFontSize);
  const hostRef = useRef<HTMLDivElement>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const sessionRef = useRef<string | null>(null);
  const [height, setHeight] = useState(200);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

  const repoName = repositories.find((r) => r.id === activeRepoId)?.name;

  useEffect(() => {
    if (!hostRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: "bar",
      cursorWidth: 1.5,
      fontFamily: '"Cascadia Code", "JetBrains Mono", Consolas, "Courier New", monospace',
      fontSize,
      fontWeight: "400",
      lineHeight: 1.35,
      letterSpacing: 0,
      theme: {
        background: "#0e1015",
        foreground: "#c9cdd4",
        cursor: "#c9cdd4",
        cursorAccent: "#0e1015",
        selectionBackground: "#3d8bfd55",
        selectionForeground: "#f0f1f4",
        black: "#0e1015",
        red: "#f85149",
        green: "#3dd68c",
        yellow: "#e3b341",
        blue: "#58a6ff",
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
      convertEol: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(hostRef.current);
    termRef.current = term;
    fitRef.current = fit;

    const fitNow = () => {
      try {
        fit.fit();
        const id = sessionRef.current;
        if (id) void api.terminalResize(id, term.cols, term.rows);
      } catch {
        /* host not visible yet */
      }
    };
    requestAnimationFrame(fitNow);

    let unlisten: (() => void) | undefined;
    let disposed = false;

    const boot = async () => {
      const sessionId = await api.terminalCreate(activeRepoId, term.cols, term.rows);
      if (disposed) {
        await api.terminalKill(sessionId);
        return;
      }
      sessionRef.current = sessionId;
      fitNow();

      unlisten = await listen<TerminalPayload>("terminal://data", (event) => {
        if (event.payload.sessionId !== sessionRef.current) return;
        if (event.payload.data) term.write(event.payload.data);
        if (event.payload.done) {
          const lang = usePrefsStore.getState().language;
          term.writeln(`\r\n${translate(lang, "terminal.ended")}`);
        }
      });

      term.onData((data) => {
        const id = sessionRef.current;
        if (id) void api.terminalWrite(id, data);
      });
    };

    void boot().catch((err) => {
      const lang = usePrefsStore.getState().language;
      term.writeln(`\r\n${translate(lang, "terminal.error", { error: String(err) })}`);
    });

    const ro = new ResizeObserver(() => fitNow());
    ro.observe(hostRef.current);

    return () => {
      disposed = true;
      ro.disconnect();
      unlisten?.();
      const id = sessionRef.current;
      sessionRef.current = null;
      termRef.current = null;
      fitRef.current = null;
      if (id) void api.terminalKill(id);
      term.dispose();
    };
  }, [activeRepoId, fontSize]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = dragRef.current.startY - e.clientY;
      const next = Math.min(420, Math.max(140, dragRef.current.startH + delta));
      setHeight(next);
    };
    const onUp = () => {
      dragRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      requestAnimationFrame(() => {
        try {
          fitRef.current?.fit();
          const term = termRef.current;
          const id = sessionRef.current;
          if (term && id) void api.terminalResize(id, term.cols, term.rows);
        } catch {
          /* ignore */
        }
      });
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
      className="flex shrink-0 flex-col border-t border-[#2d3139] bg-[#0e1015]"
      style={{ height }}
    >
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label={t("terminal.resize")}
        className="group flex h-1.5 shrink-0 cursor-ns-resize items-center justify-center hover:bg-[#3d8bfd]/25"
        onMouseDown={(e) => {
          dragRef.current = { startY: e.clientY, startH: height };
          document.body.style.cursor = "ns-resize";
          document.body.style.userSelect = "none";
        }}
      >
        <span className="h-0.5 w-8 rounded-full bg-[#3a3f4b] group-hover:bg-[#3d8bfd]/70" />
      </div>

      <div className="flex h-8 shrink-0 items-center justify-between border-b border-[#2d3139] bg-[#161920] px-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <IconTerminal className="h-3.5 w-3.5 shrink-0 text-[#6b7280]" />
          <span className="text-[11px] font-medium text-[#c8ccd4]">{t("terminal.title")}</span>
          {repoName && (
            <>
              <span className="text-[#3a3f4b]">·</span>
              <span className="truncate font-mono text-[10px] text-[#6b7280]">{repoName}</span>
            </>
          )}
        </div>
        <button
          type="button"
          title={t("terminal.close")}
          aria-label={t("terminal.close")}
          className="flex h-5 w-5 items-center justify-center rounded text-[13px] leading-none text-[#6b7280] hover:bg-[#2a2e38] hover:text-[#e8eaed]"
          onClick={() => setTerminalOpen(false)}
        >
          ×
        </button>
      </div>

      <div className="gk-term relative min-h-0 flex-1 overflow-hidden px-3 pb-2.5 pt-2">
        <div ref={hostRef} className="h-full w-full overflow-hidden" />
      </div>
    </div>
  );
}
