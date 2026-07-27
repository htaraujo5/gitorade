/**
 * Build a folder tree from branch names split on `/`
 * (e.g. fix/TXKB-2166 → folder "fix" → leaf "TXKB-2166").
 */

export type BranchLeaf = {
  kind: "branch";
  /** Full git ref name used for actions */
  fullName: string;
  /** Label shown in the row (last path segment) */
  label: string;
};

export type BranchFolder = {
  kind: "folder";
  name: string;
  children: BranchTreeNode[];
  /** Total leaf count under this folder */
  count: number;
};

export type BranchTreeNode = BranchFolder | BranchLeaf;

type BranchLike = { name: string };

/**
 * @param branches branch list
 * @param stripPrefix optional prefix to remove before splitting
 *   (e.g. "origin/" for remote-tracking branches)
 */
export function buildBranchTree(branches: BranchLike[], stripPrefix = ""): BranchTreeNode[] {
  type Mutable = {
    folders: Map<string, Mutable>;
    leaves: BranchLeaf[];
  };

  const root: Mutable = { folders: new Map(), leaves: [] };

  for (const b of branches) {
    let rest = b.name;
    if (stripPrefix && rest.startsWith(stripPrefix)) {
      rest = rest.slice(stripPrefix.length);
    }
    // Also strip refs/heads|remotes noise if present
    rest = rest.replace(/^refs\/(heads|remotes)\//, "");
    if (stripPrefix === "" && rest.includes("/")) {
      // local: keep as-is
    }

    const parts = rest.split("/").filter(Boolean);
    if (parts.length === 0) continue;

    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      let child = node.folders.get(part);
      if (!child) {
        child = { folders: new Map(), leaves: [] };
        node.folders.set(part, child);
      }
      node = child;
    }

    const label = parts[parts.length - 1];
    node.leaves.push({ kind: "branch", fullName: b.name, label });
  }

  const toNodes = (m: Mutable): BranchTreeNode[] => {
    const folders: BranchFolder[] = [...m.folders.entries()]
      .sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: "base" }))
      .map(([name, child]) => {
        const children = toNodes(child);
        const count = children.reduce((n, c) => n + (c.kind === "folder" ? c.count : 1), 0);
        return { kind: "folder" as const, name, children, count };
      });

    const leaves = [...m.leaves].sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
    );

    // Folders first, then bare branches (GitKraken-style)
    return [...folders, ...leaves];
  };

  return toNodes(root);
}
