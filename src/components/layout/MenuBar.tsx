import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAppStore } from "../../stores/appStore";
import { usePrefsStore } from "../../stores/prefsStore";

type MenuDef = {
  id: string;
  label: string;
  items: {
    label: string;
    shortcut?: string;
    action?: () => void;
    danger?: boolean;
    disabled?: boolean;
  }[];
};

/** Native-app style menu bar (Arquivo / Editar / Exibir / Ajuda). */
export function MenuBar({ embedded = false }: { embedded?: boolean }) {
  const {
    openRepositoryDialog,
    initRepositoryDialog,
    openStartTab,
    openSettingsTab,
    openCredentialsTab,
    openAboutTab,
    setTerminalOpen,
    terminalOpen,
    commit,
    fetch,
    pull,
    push,
    setCommitSearchOpen,
    activeRepoId,
    busy,
  } = useAppStore();
  const enableTerminal = usePrefsStore((s) => s.enableTerminal);

  const [openId, setOpenId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const hasRepo = Boolean(activeRepoId);

  useEffect(() => {
    if (!openId) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpenId(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenId(null);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [openId]);

  const menus: MenuDef[] = [
    {
      id: "file",
      label: "Arquivo",
      items: [
        {
          label: "Abrir repositório…",
          shortcut: "Ctrl+P",
          action: () => void openRepositoryDialog(),
        },
        {
          label: "Novo repositório…",
          action: () => void initRepositoryDialog(),
        },
        {
          label: "Start",
          action: () => openStartTab(),
        },
        {
          label: "Credenciais",
          action: () => openCredentialsTab(),
        },
        {
          label: "Preferências",
          action: () => openSettingsTab(),
        },
      ],
    },
    {
      id: "edit",
      label: "Editar",
      items: [
        {
          label: "Buscar commits…",
          disabled: !hasRepo,
          action: () => setCommitSearchOpen(true),
        },
        {
          label: "Commit",
          shortcut: "Ctrl+Enter",
          disabled: !hasRepo || busy,
          action: () => void commit(),
        },
      ],
    },
    {
      id: "view",
      label: "Exibir",
      items: [
        {
          label: terminalOpen ? "Ocultar terminal" : "Mostrar terminal",
          shortcut: "Ctrl+`",
          disabled: !hasRepo || !enableTerminal,
          action: () => setTerminalOpen(!terminalOpen),
        },
        {
          label: "Fetch",
          disabled: !hasRepo || busy,
          action: () => void fetch(),
        },
        {
          label: "Pull",
          disabled: !hasRepo || busy,
          action: () => void pull(),
        },
        {
          label: "Push",
          disabled: !hasRepo || busy,
          action: () => void push(),
        },
      ],
    },
    {
      id: "help",
      label: "Ajuda",
      items: [
        {
          label: "Sobre o Gitorade",
          action: () => openAboutTab(),
        },
      ],
    },
  ];

  return (
    <div
      ref={rootRef}
      className={
        embedded
          ? "relative z-[45] flex h-full items-center gap-0.5 px-0.5"
          : "relative z-[45] flex h-6 shrink-0 items-center border-b border-[#2d3139] bg-[#14161c] px-1"
      }
      role="menubar"
    >
      {menus.map((menu) => (
        <MenuButton
          key={menu.id}
          label={menu.label}
          open={openId === menu.id}
          onOpen={() => setOpenId(menu.id)}
          onHoverOpen={() => {
            if (openId) setOpenId(menu.id);
          }}
          onClose={() => setOpenId(null)}
          items={menu.items}
        />
      ))}
    </div>
  );
}

function MenuButton({
  label,
  open,
  onOpen,
  onHoverOpen,
  onClose,
  items,
}: {
  label: string;
  open: boolean;
  onOpen: () => void;
  onHoverOpen: () => void;
  onClose: () => void;
  items: MenuDef["items"];
}) {
  return (
    <div className="relative">
      <button
        type="button"
        role="menuitem"
        aria-haspopup="true"
        aria-expanded={open}
        className={`rounded px-2 py-0.5 text-[11px] leading-none ${
          open
            ? "bg-[#2a2e38] text-[#e8eaed]"
            : "text-[#a8adb8] hover:bg-[#252830] hover:text-[#e8eaed]"
        }`}
        onClick={() => (open ? onClose() : onOpen())}
        onMouseEnter={onHoverOpen}
      >
        {label}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 min-w-[220px] overflow-hidden rounded-md border border-[#3a3f4b] bg-[#252830] py-1 shadow-2xl shadow-black/50"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className={`flex w-full items-center justify-between gap-6 px-3 py-1.5 text-left text-[11px] disabled:opacity-35 ${
                item.danger
                  ? "text-[#f85149] hover:bg-[#3a2228]"
                  : "text-[#d0d4dc] hover:bg-[#2f3440]"
              }`}
              onClick={() => {
                if (item.disabled) return;
                item.action?.();
                onClose();
              }}
            >
              <span>{item.label}</span>
              {item.shortcut && <span className="text-[10px] text-[#6b7280]">{item.shortcut}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function MenuBarSpacer({ children }: { children?: ReactNode }) {
  return children ?? null;
}
