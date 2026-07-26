import { useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { useAppStore } from "../../stores/appStore";
import { IconBranch } from "../Icons";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu";

type MenuState = { x: number; y: number; branch: string; isRemote: boolean; isCurrent: boolean };

/**
 * LOCAL / REMOTE sidebar:
 * - 1 click = select
 * - 2 clicks = checkout
 * - right-click = actions
 * - drag branch onto another = merge
 * - REMOTE shows configured remotes (URL) + tracking branches
 */
export function BranchSidebar() {
  const {
    branches,
    branchFilter,
    setBranchFilter,
    checkoutBranch,
    createBranch,
    renameBranch,
    deleteBranch,
    mergeBranch,
    busy,
    status,
    remotes,
    selectedBranchName,
    setSelectedBranchName,
    setWorkspaceTab,
    selectCommit,
  } = useAppStore();

  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [localOpen, setLocalOpen] = useState(true);
  const [remoteOpen, setRemoteOpen] = useState(true);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  const current = status?.branch ?? branches.find((b) => b.isCurrent)?.name ?? null;

  const filtered = useMemo(() => {
    const q = branchFilter.trim().toLowerCase();
    if (!q) return branches;
    return branches.filter((b) => b.name.toLowerCase().includes(q));
  }, [branches, branchFilter]);

  const local = filtered.filter((b) => !b.isRemote);
  const remoteBranches = filtered.filter((b) => b.isRemote);

  const openCreate = (from?: string) => {
    const base = from ? `${from.replace(/^.*\//, "")}-` : "";
    const name = window.prompt("Nome da nova branch:", base);
    if (!name?.trim()) return;
    void createBranch(name.trim(), true);
  };

  const doMerge = async (source: string, target: string) => {
    if (source === target) return;
    const ok = window.confirm(
      `Merge "${source}" → "${target}"?\n\nCheckout em ${target} (se preciso) e merge de ${source}.`,
    );
    if (!ok) return;
    if (current !== target) {
      await checkoutBranch(target);
    }
    await mergeBranch(source);
  };

  const selectBranch = (name: string) => {
    setSelectedBranchName(name);
    void selectCommit(null);
  };

  const menuItems = (m: MenuState): ContextMenuItem[] => {
    const short = m.branch.replace(/^.*\//, "");
    const items: ContextMenuItem[] = [];

    if (!m.isCurrent) {
      items.push({
        type: "item",
        label: `Checkout ${short}`,
        onClick: () => void checkoutBranch(m.branch),
      });
    }

    items.push({
      type: "item",
      label: "Create branch here…",
      onClick: () => openCreate(m.branch),
    });

    if (!m.isRemote && !m.isCurrent && current) {
      items.push({
        type: "item",
        label: `Merge into ${current}…`,
        onClick: () => void doMerge(m.branch, current),
      });
    }

    if (!m.isRemote) {
      items.push({ type: "separator" });
      items.push({
        type: "item",
        label: `Rename ${short}…`,
        disabled: busy,
        onClick: () => {
          const next = window.prompt("Novo nome:", short);
          if (!next?.trim() || next.trim() === short) return;
          void renameBranch(m.branch, next.trim());
        },
      });
      items.push({
        type: "item",
        label: `Delete ${short}…`,
        danger: true,
        disabled: m.isCurrent,
        onClick: () => {
          if (m.isCurrent) return;
          if (!window.confirm(`Excluir branch "${short}"?`)) return;
          void deleteBranch(m.branch, false);
        },
      });
    }

    items.push({ type: "separator" });
    items.push({
      type: "item",
      label: "Copy branch name",
      onClick: () => void navigator.clipboard.writeText(m.branch),
    });

    return items;
  };

  return (
    <aside
      className="flex w-[220px] shrink-0 flex-col border-r border-[#2d3139] bg-[#171a20]"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="flex items-center gap-1 border-b border-[#2d3139] px-2 py-1.5">
        <input
          className="h-6 min-w-0 flex-1 rounded border border-[#2d3139] bg-[#1c1f26] px-2 text-[11px] text-[#e8eaed] outline-none placeholder:text-[#5c6370] focus:border-[#3d8bfd]"
          placeholder="Filter (Ctrl+Alt+F)"
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
        />
        <button
          type="button"
          className="shrink-0 rounded px-1.5 py-0.5 text-[12px] leading-none text-[#6b7280] hover:bg-[#252830] hover:text-[#3dd68c]"
          title="Nova branch"
          onClick={() => setAdding((v) => !v)}
        >
          +
        </button>
      </div>

      {adding && (
        <form
          className="flex gap-1 border-b border-[#2d3139] px-2 py-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newName.trim()) return;
            void createBranch(newName.trim(), true);
            setNewName("");
            setAdding(false);
          }}
        >
          <input
            autoFocus
            className="min-w-0 flex-1 rounded border border-[#2d3139] bg-[#1c1f26] px-1.5 py-0.5 text-[11px] outline-none focus:border-[#3d8bfd]"
            placeholder="branch name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={() => {
              if (!newName.trim()) setAdding(false);
            }}
          />
          <button
            type="submit"
            disabled={busy || !newName.trim()}
            className="rounded bg-[#238636] px-1.5 text-[10px] font-semibold text-white disabled:opacity-40"
          >
            +
          </button>
        </form>
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        <p className="px-2.5 pb-1 pt-1.5 text-[9px] leading-snug text-[#5c6370]">
          1 clique seleciona · 2 cliques checkout · arraste p/ merge
        </p>

        <Group
          title="LOCAL"
          count={local.length}
          open={localOpen}
          onToggle={() => setLocalOpen((v) => !v)}
        >
          {local.map((b) => (
            <BranchRow
              key={b.name}
              name={b.name}
              isCurrent={b.isCurrent}
              isSelected={selectedBranchName === b.name}
              isRemote={false}
              busy={busy}
              dragOver={dragOver === b.name}
              dragging={dragging === b.name}
              onSelect={() => selectBranch(b.name)}
              onCheckout={() => {
                if (!b.isCurrent) void checkoutBranch(b.name);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                selectBranch(b.name);
                setMenu({
                  x: e.clientX,
                  y: e.clientY,
                  branch: b.name,
                  isRemote: false,
                  isCurrent: b.isCurrent,
                });
              }}
              onDragStart={() => setDragging(b.name)}
              onDragEnd={() => {
                setDragging(null);
                setDragOver(null);
              }}
              onDragOver={() => setDragOver(b.name)}
              onDragLeave={() => setDragOver((cur) => (cur === b.name ? null : cur))}
              onDrop={(source) => {
                setDragOver(null);
                setDragging(null);
                void doMerge(source, b.name);
              }}
            />
          ))}
        </Group>

        <Group
          title="REMOTE"
          count={remotes.length}
          open={remoteOpen}
          onToggle={() => setRemoteOpen((v) => !v)}
        >
          {remotes.length === 0 ? (
            <div className="space-y-1 px-2.5 py-1.5 text-[10px] leading-snug text-[#5c6370]">
              <p>Nenhum remote no .git/config deste repo.</p>
              <p>Cole a URL do origin no painel direito (bloco Sem remote).</p>
            </div>
          ) : (
            remotes.map((r) => {
              const url = r.fetchUrl ?? r.pushUrl ?? "";
              const kids = remoteBranches.filter(
                (b) => b.name === r.name || b.name.startsWith(`${r.name}/`),
              );
              return (
                <div key={r.name} className="mb-1">
                  <div className="px-2.5 py-1" title={url}>
                    <div className="truncate text-[11px] font-normal text-[#c8ccd4]">
                      {r.name}
                    </div>
                    <div className="truncate font-mono text-[9px] text-[#5c6370]">
                      {url || "(sem URL)"}
                    </div>
                  </div>
                  {kids.length === 0 ? (
                    <p className="px-2.5 pb-1 text-[9px] text-[#5c6370]">
                      Sem branches remotas — faça Fetch.
                    </p>
                  ) : (
                    kids.map((b) => (
                      <BranchRow
                        key={b.name}
                        name={b.name}
                        isCurrent={false}
                        isSelected={selectedBranchName === b.name}
                        isRemote
                        busy={busy}
                        dragOver={false}
                        dragging={false}
                        onSelect={() => selectBranch(b.name)}
                        onCheckout={() => void checkoutBranch(b.name)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          selectBranch(b.name);
                          setMenu({
                            x: e.clientX,
                            y: e.clientY,
                            branch: b.name,
                            isRemote: true,
                            isCurrent: false,
                          });
                        }}
                      />
                    ))
                  )}
                </div>
              );
            })
          )}
        </Group>

        <Group title="STASH" count={0} open={false} onToggle={() => setWorkspaceTab("stash")}>
          {null}
        </Group>
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems(menu)}
          onClose={() => setMenu(null)}
        />
      )}
    </aside>
  );
}

function BranchRow({
  name,
  isCurrent,
  isSelected,
  isRemote,
  busy,
  dragOver,
  dragging,
  onSelect,
  onCheckout,
  onContextMenu,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  name: string;
  isCurrent: boolean;
  isSelected: boolean;
  isRemote: boolean;
  busy: boolean;
  dragOver: boolean;
  dragging: boolean;
  onSelect: () => void;
  onCheckout: () => void;
  onContextMenu: (e: MouseEvent) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDragOver?: () => void;
  onDragLeave?: () => void;
  onDrop?: (source: string) => void;
}) {
  const label = name.replace(/^refs\/(heads|remotes)\//, "");

  return (
    <button
      type="button"
      disabled={busy}
      draggable={!isRemote}
      onClick={onSelect}
      onDoubleClick={onCheckout}
      onContextMenu={onContextMenu}
      onDragStart={(e) => {
        if (isRemote) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.setData("text/gitorade-branch", name);
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.();
      }}
      onDragEnd={() => onDragEnd?.()}
      onDragOver={(e) => {
        if (isRemote) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        onDragOver?.();
      }}
      onDragLeave={() => onDragLeave?.()}
      onDrop={(e) => {
        if (isRemote) return;
        e.preventDefault();
        const source = e.dataTransfer.getData("text/gitorade-branch");
        if (source && source !== name) onDrop?.(source);
      }}
      title={
        isRemote
          ? "1 clique seleciona · 2 cliques checkout · botão direito"
          : "1 clique seleciona · 2 cliques checkout · arraste p/ merge"
      }
          className={`flex h-6 w-full items-center gap-1.5 px-2.5 text-left text-[11px] font-normal ${
        dragOver
          ? "bg-[#1e3a5f] text-[#d8dbe2] ring-1 ring-inset ring-[#3d8bfd]"
          : isCurrent
            ? "bg-[#1a3d2a] text-[#3dd68c]"
            : isSelected
              ? "bg-[#1e3a5f]/70 text-[#d8dbe2]"
              : dragging
                ? "opacity-40"
                : "text-[#8b909a] hover:bg-[#1c1f26] hover:text-[#d8dbe2]"
      }`}
    >
      {isCurrent ? (
        <span className="w-3 text-center text-[9px]">✓</span>
      ) : (
        <IconBranch className="h-3 w-3 shrink-0 opacity-45" />
      )}
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  );
}

function Group({
  title,
  count,
  open,
  onToggle,
  children,
}: {
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-[9px] font-normal tracking-[0.08em] text-[#6b7280] hover:text-[#a0a6b0]"
      >
        <span className="w-2 text-[8px] opacity-70">{open ? "▾" : "▸"}</span>
        <span className="flex-1 text-left uppercase">{title}</span>
        <span className="tabular-nums text-[#5c6370]">{count}</span>
      </button>
      {open && children}
    </div>
  );
}
