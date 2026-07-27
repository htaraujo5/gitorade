import { useMemo, useState } from "react";
import { useAppStore } from "../../stores/appStore";
import { requireDangerousConfirm } from "../../lib/dangerousConfirm";

export function BranchesView() {
  const {
    branches,
    branchFilter,
    setBranchFilter,
    createBranch,
    checkoutBranch,
    renameBranch,
    deleteBranch,
    mergeBranch,
    rebaseOnto,
    status,
    busy,
  } = useAppStore();

  const [newName, setNewName] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = branchFilter.trim().toLowerCase();
    if (!q) return branches;
    return branches.filter((b) => b.name.toLowerCase().includes(q));
  }, [branches, branchFilter]);

  const local = filtered.filter((b) => !b.isRemote);
  const remote = filtered.filter((b) => b.isRemote);
  const current = branches.find((b) => b.isCurrent);
  const selectedBranch = branches.find((b) => b.name === selected) ?? current ?? null;

  return (
    <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[1fr_280px]">
      <div className="flex min-h-0 flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <input
            className="min-w-[180px] flex-1 rounded-[var(--radius-sm)] border border-border bg-bg-secondary px-3 py-1.5 text-sm outline-none focus:border-primary"
            placeholder="Buscar branches…"
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
          />
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newName.trim()) return;
              void createBranch(newName.trim(), true);
              setNewName("");
            }}
          >
            <input
              className="w-40 rounded-[var(--radius-sm)] border border-border bg-bg-secondary px-2 py-1.5 text-sm outline-none focus:border-primary"
              placeholder="nova branch"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <button
              type="submit"
              disabled={busy || !newName.trim()}
              className="brand-gradient rounded-[var(--radius-sm)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
            >
              Criar
            </button>
          </form>
        </div>

        <div className="min-h-0 flex-1 overflow-auto rounded-[var(--radius-md)] border border-border bg-bg-secondary">
          <BranchGroup
            title="Local"
            items={local}
            selected={selectedBranch?.name ?? null}
            onSelect={setSelected}
            onCheckout={(name) => void checkoutBranch(name)}
            busy={busy}
          />
          <BranchGroup
            title="Remotes"
            items={remote}
            selected={selectedBranch?.name ?? null}
            onSelect={setSelected}
            onCheckout={(name) => void checkoutBranch(name)}
            busy={busy}
          />
        </div>
      </div>

      <aside className="rounded-[var(--radius-md)] border border-border bg-bg-secondary p-4 text-sm">
        <div className="mb-3 text-xs font-medium uppercase tracking-wide text-text-muted">
          Detalhes
        </div>
        {!selectedBranch ? (
          <p className="text-xs text-text-muted">Selecione uma branch.</p>
        ) : (
          <div className="space-y-3">
            <div>
              <div className="font-medium">{selectedBranch.name}</div>
              {selectedBranch.isCurrent && (
                <span className="mt-1 inline-block rounded-full bg-success/20 px-2 py-0.5 text-[10px] text-success">
                  Current
                </span>
              )}
            </div>
            <div className="text-xs text-text-muted">
              {selectedBranch.upstream ? `Upstream: ${selectedBranch.upstream}` : "Sem upstream"}
            </div>
            <div className="text-xs">
              {selectedBranch.ahead != null || selectedBranch.behind != null ? (
                <span>
                  <span className="text-success">{selectedBranch.ahead ?? 0} ahead</span>
                  {" · "}
                  <span className="text-warning">{selectedBranch.behind ?? 0} behind</span>
                </span>
              ) : status?.upstream ? (
                <span>
                  <span className="text-success">{status.ahead} ahead</span>
                  {" · "}
                  <span className="text-warning">{status.behind} behind</span>
                </span>
              ) : (
                <span className="text-text-muted">Sem tracking</span>
              )}
            </div>
            {selectedBranch.tipHash && (
              <div className="font-mono text-[11px] text-text-muted">{selectedBranch.tipHash}</div>
            )}

            <div className="flex flex-col gap-2 pt-2">
              {!selectedBranch.isCurrent && (
                <button
                  type="button"
                  disabled={busy}
                  className="brand-gradient rounded-[var(--radius-sm)] px-3 py-2 text-xs font-medium text-white disabled:opacity-40"
                  onClick={() => void checkoutBranch(selectedBranch.name)}
                >
                  Checkout
                </button>
              )}
              {!selectedBranch.isCurrent && (
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-[var(--radius-sm)] border border-merge/40 px-3 py-2 text-xs text-merge hover:bg-merge/10 disabled:opacity-40"
                  onClick={() => {
                    if (
                      requireDangerousConfirm(`Mesclar ${selectedBranch.name} na branch atual?`)
                    ) {
                      void mergeBranch(selectedBranch.name);
                    }
                  }}
                >
                  Merge into current
                </button>
              )}
              {!selectedBranch.isCurrent && (
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-[var(--radius-sm)] border border-rebase/40 px-3 py-2 text-xs text-rebase hover:bg-rebase/10 disabled:opacity-40"
                  onClick={() => {
                    if (
                      requireDangerousConfirm(
                        `Rebase da branch atual sobre ${selectedBranch.name}?`,
                      )
                    ) {
                      void rebaseOnto(selectedBranch.name);
                    }
                  }}
                >
                  Rebase onto
                </button>
              )}
              {!selectedBranch.isRemote && !selectedBranch.isCurrent && (
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-[var(--radius-sm)] border border-danger/40 px-3 py-2 text-xs text-danger hover:bg-danger/10 disabled:opacity-40"
                  onClick={() => {
                    if (requireDangerousConfirm(`Excluir branch ${selectedBranch.name}?`)) {
                      void deleteBranch(selectedBranch.name, false);
                    }
                  }}
                >
                  Excluir
                </button>
              )}
              {!selectedBranch.isRemote && (
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-[var(--radius-sm)] border border-border px-3 py-2 text-xs hover:bg-surface disabled:opacity-40"
                  onClick={() => {
                    const next = window.prompt("Novo nome", selectedBranch.name);
                    if (next && next !== selectedBranch.name) {
                      void renameBranch(selectedBranch.name, next);
                    }
                  }}
                >
                  Renomear
                </button>
              )}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function BranchGroup({
  title,
  items,
  selected,
  onSelect,
  onCheckout,
  busy,
}: {
  title: string;
  items: ReturnType<typeof useAppStore.getState>["branches"];
  selected: string | null;
  onSelect: (name: string) => void;
  onCheckout: (name: string) => void;
  busy: boolean;
}) {
  return (
    <div className="border-b border-border last:border-b-0">
      <div className="px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-text-muted">
        {title} ({items.length})
      </div>
      {items.length === 0 ? (
        <p className="px-3 pb-3 text-xs text-text-muted">Nenhuma.</p>
      ) : (
        <ul>
          {items.map((branch) => (
            <li key={branch.name}>
              <button
                type="button"
                onClick={() => onSelect(branch.name)}
                onDoubleClick={() => {
                  if (!branch.isCurrent) onCheckout(branch.name);
                }}
                disabled={busy}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-surface ${
                  selected === branch.name ? "bg-surface" : ""
                }`}
              >
                <span className="truncate">
                  {branch.isCurrent && <span className="mr-1 text-success">●</span>}
                  {branch.name}
                </span>
                {(branch.ahead != null || branch.behind != null) && (
                  <span className="ml-2 shrink-0 text-[10px] text-text-muted">
                    ↑{branch.ahead ?? 0} ↓{branch.behind ?? 0}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
