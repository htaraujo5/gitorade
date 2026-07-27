import { useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { useAppStore } from "../../stores/appStore";
import { requireDangerousConfirm } from "../../lib/dangerousConfirm";
import { useT } from "../../i18n";
import { IconBranch, IconCloud, IconGithub, IconLaptop, IconTag } from "../Icons";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu";
import { buildBranchTree, type BranchTreeNode } from "../../lib/branchTree";
import { remotesLookLikeGithub } from "../../lib/refDecorate";

type MenuState = {
  x: number;
  y: number;
  branch: string;
  isRemote: boolean;
  isCurrent: boolean;
};

/**
 * LOCAL / REMOTE sidebar with folder grouping (fix/, feat/, …):
 * - 1 click = select
 * - 2 clicks = checkout
 * - right-click = actions
 * - drag branch onto another = merge
 */
export function BranchSidebar() {
  const t = useT();
  const {
    branches,
    tags,
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
    focusBranchInGraph,
    focusTagInGraph,
  } = useAppStore();

  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [localOpen, setLocalOpen] = useState(true);
  const [remoteOpen, setRemoteOpen] = useState(true);
  const [tagsOpen, setTagsOpen] = useState(true);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  /** Collapsed folder keys: "local:fix", "remote:origin/feat", … */
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const current = status?.branch ?? branches.find((b) => b.isCurrent)?.name ?? null;

  const filtered = useMemo(() => {
    const q = branchFilter.trim().toLowerCase();
    if (!q) return branches;
    return branches.filter((b) => b.name.toLowerCase().includes(q));
  }, [branches, branchFilter]);

  const filteredTags = useMemo(() => {
    const q = branchFilter.trim().toLowerCase();
    if (!q) return tags;
    return tags.filter((tag) => tag.name.toLowerCase().includes(q));
  }, [tags, branchFilter]);

  const local = filtered.filter((b) => !b.isRemote);
  const remoteBranches = filtered.filter((b) => b.isRemote);
  const localTree = useMemo(() => buildBranchTree(local), [local]);
  const useGithub = remotesLookLikeGithub(remotes);
  const RemoteIcon = useGithub ? IconGithub : IconCloud;

  const toggleFolder = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const openCreate = (from?: string) => {
    const base = from ? `${from.replace(/^.*\//, "")}-` : "";
    const name = window.prompt("Nome da nova branch:", base);
    if (!name?.trim()) return;
    void createBranch(name.trim(), true);
  };

  const doMerge = async (source: string, target: string) => {
    if (source === target) return;
    const ok = requireDangerousConfirm(
      `Merge "${source}" → "${target}"?\n\nCheckout em ${target} (se preciso) e merge de ${source}.`,
    );
    if (!ok) return;
    if (current !== target) {
      await checkoutBranch(target);
    }
    await mergeBranch(source);
  };

  const selectBranch = (name: string) => {
    void focusBranchInGraph(name);
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
          if (!requireDangerousConfirm(`Excluir branch "${short}"?`)) return;
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

  const renderBranch = (fullName: string, label: string, isRemote: boolean, depth: number) => {
    const b = branches.find((x) => x.name === fullName);
    const isCurrent = Boolean(b?.isCurrent);
    return (
      <BranchRow
        key={fullName}
        name={fullName}
        label={label}
        depth={depth}
        isCurrent={isCurrent}
        isSelected={selectedBranchName === fullName}
        isRemote={isRemote}
        busy={busy}
        dragOver={dragOver === fullName}
        dragging={dragging === fullName}
        onSelect={() => selectBranch(fullName)}
        onCheckout={() => {
          if (!isCurrent) void checkoutBranch(fullName);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          selectBranch(fullName);
          setMenu({
            x: e.clientX,
            y: e.clientY,
            branch: fullName,
            isRemote,
            isCurrent,
          });
        }}
        onDragStart={isRemote ? undefined : () => setDragging(fullName)}
        onDragEnd={
          isRemote
            ? undefined
            : () => {
                setDragging(null);
                setDragOver(null);
              }
        }
        onDragOver={isRemote ? undefined : () => setDragOver(fullName)}
        onDragLeave={
          isRemote ? undefined : () => setDragOver((cur) => (cur === fullName ? null : cur))
        }
        onDrop={
          isRemote
            ? undefined
            : (source) => {
                setDragOver(null);
                setDragging(null);
                void doMerge(source, fullName);
              }
        }
      />
    );
  };

  const renderTree = (
    nodes: BranchTreeNode[],
    scope: string,
    isRemote: boolean,
    depth: number,
  ): ReactNode =>
    nodes.map((node) => {
      if (node.kind === "branch") {
        return renderBranch(node.fullName, node.label, isRemote, depth);
      }
      const key = `${scope}/${node.name}`;
      const open = !collapsed.has(key);
      return (
        <div key={key}>
          <button
            type="button"
            onClick={() => toggleFolder(key)}
            className="flex h-6 w-full items-center gap-1 text-left text-[11px] text-[#8b909a] hover:bg-[#1c1f26] hover:text-[#d8dbe2]"
            style={{ paddingLeft: rowPad(depth), paddingRight: 8 }}
            title={`${node.name}/ (${node.count})`}
          >
            <Chevron open={open} />
            <IconFolder className="h-3 w-3 shrink-0 opacity-70" />
            <span className="min-w-0 flex-1 truncate font-medium">{node.name}</span>
            <span className="tabular-nums text-[9px] text-[#5c6370]">{node.count}</span>
          </button>
          {open && renderTree(node.children, key, isRemote, depth + 1)}
        </div>
      );
    });

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
            placeholder="feat/minha-branch"
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
          title={t("branches.local")}
          icon={<IconLaptop className="h-3 w-3" />}
          count={local.length}
          open={localOpen}
          onToggle={() => setLocalOpen((v) => !v)}
        >
          {renderTree(localTree, "local", false, 0)}
        </Group>

        <Group
          title={t("branches.remote")}
          icon={<RemoteIcon className="h-3 w-3" />}
          count={remoteBranches.length}
          open={remoteOpen}
          onToggle={() => setRemoteOpen((v) => !v)}
        >
          {remotes.length === 0 ? (
            <div className="space-y-1 px-2.5 py-1.5 text-[10px] leading-snug text-[#5c6370]">
              <p>Nenhum remote no .git/config deste repo.</p>
              <p>Adicione um remote via Fetch/Pull ou git remote add.</p>
            </div>
          ) : (
            remotes.map((r) => {
              const kids = remoteBranches.filter(
                (b) => b.name === r.name || b.name.startsWith(`${r.name}/`),
              );
              const tracking = kids.filter((b) => b.name !== r.name);
              const tree = buildBranchTree(tracking, `${r.name}/`);
              const remoteKey = `remote:${r.name}`;
              const remoteOpenRow = !collapsed.has(remoteKey);
              return (
                <div key={r.name}>
                  <button
                    type="button"
                    onClick={() => toggleFolder(remoteKey)}
                    className="flex h-6 w-full items-center gap-1 text-left text-[11px] text-[#c8ccd4] hover:bg-[#1c1f26]"
                    style={{ paddingLeft: rowPad(0), paddingRight: 8 }}
                    title={r.name}
                  >
                    <Chevron open={remoteOpenRow} />
                    <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
                    <span className="tabular-nums text-[9px] text-[#5c6370]">
                      {tracking.length}
                    </span>
                  </button>
                  {remoteOpenRow &&
                    (tracking.length === 0 ? (
                      <p
                        className="py-1 text-[9px] text-[#5c6370]"
                        style={{ paddingLeft: rowPad(1), paddingRight: 8 }}
                      >
                        {t("branches.empty")}
                      </p>
                    ) : (
                      renderTree(tree, remoteKey, true, 1)
                    ))}
                </div>
              );
            })
          )}
        </Group>

        <Group
          title={t("branches.tags")}
          icon={<IconTag className="h-3 w-3" />}
          count={filteredTags.length}
          open={tagsOpen}
          onToggle={() => setTagsOpen((v) => !v)}
        >
          {filteredTags.length === 0 ? (
            <p className="px-2.5 py-1.5 text-[10px] text-[#5c6370]">{t("branches.emptyTags")}</p>
          ) : (
            filteredTags.map((tag) => (
              <button
                key={tag.name}
                type="button"
                onClick={() => void focusTagInGraph(tag.name)}
                className="flex h-6 w-full items-center gap-1.5 text-left text-[11px] text-[#8b909a] hover:bg-[#1c1f26] hover:text-[#d8dbe2]"
                style={{ paddingLeft: rowPad(0), paddingRight: 8 }}
                title={tag.tipHash ? `${tag.name} @ ${tag.tipHash}` : tag.name}
              >
                <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                  <IconTag className="h-3 w-3 opacity-55" />
                </span>
                <span className="min-w-0 flex-1 truncate">{tag.name}</span>
              </button>
            ))
          )}
        </Group>
      </div>

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menuItems(menu)} onClose={() => setMenu(null)} />
      )}
    </aside>
  );
}

const ROW_BASE = 8;
const ROW_STEP = 12;

function rowPad(depth: number): number {
  return ROW_BASE + depth * ROW_STEP;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <span
      className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center text-[10px] font-bold leading-none text-[#a0a6b0]"
      aria-hidden
    >
      {open ? "▾" : "▸"}
    </span>
  );
}

function IconFolder({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 7h6l2 2h10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
      <path d="M3 7V5a1 1 0 0 1 1-1h5l2 2" />
    </svg>
  );
}

function BranchRow({
  name,
  label,
  depth,
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
  label: string;
  depth: number;
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
      title={name}
      className={`flex h-6 w-full items-center gap-1.5 text-left text-[11px] font-normal ${
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
      style={{ paddingLeft: rowPad(depth), paddingRight: 8 }}
    >
      <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center">
        {isCurrent ? (
          <span className="text-[9px]">✓</span>
        ) : (
          <IconBranch className="h-3 w-3 opacity-55" />
        )}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  );
}

function Group({
  title,
  icon,
  count,
  open,
  onToggle,
  children,
}: {
  title: string;
  icon?: ReactNode;
  count?: number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-1.5 px-2 py-1.5 text-[9px] font-medium tracking-[0.08em] text-[#8b909a] hover:text-[#d8dbe2]"
      >
        <Chevron open={open} />
        {icon && <span className="inline-flex shrink-0 opacity-80">{icon}</span>}
        <span className="flex-1 text-left uppercase">{title}</span>
        {count !== undefined && (
          <span className="tabular-nums text-[#3d8bfd]">{count}</span>
        )}
      </button>
      {open && children}
    </div>
  );
}
