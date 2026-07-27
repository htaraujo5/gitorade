import type { CommitSummary } from "./api";

/** Normalize git `%D` / refs/… labels to a comparable branch name. */
export function normalizeRefLabel(ref: string): string {
  let s = ref.trim();
  s = s.replace(/^HEAD ->\s*/, "");
  s = s.replace(/^refs\/(heads|remotes|tags)\//, "");
  if (s.startsWith("tag: ")) s = s.slice(5).trim();
  return s;
}

/** Target passed to `git checkout` from a decorate ref. */
export function checkoutTargetFromRef(ref: string): string {
  return normalizeRefLabel(ref);
}

/**
 * Tip of `branchName` in the loaded graph (newest-first).
 * Matches local (`feat/x`) and remote (`origin/feat/x`) decorate names.
 */
export function tipCommitForBranch(
  commits: Pick<CommitSummary, "hash" | "refs">[],
  branchName: string,
): string | null {
  const name = branchName.trim();
  if (!name) return null;

  for (const c of commits) {
    for (const ref of c.refs) {
      const short = normalizeRefLabel(ref);
      if (short === name) return c.hash;
    }
  }
  return null;
}

export function commitHasBranch(commit: Pick<CommitSummary, "refs">, branchName: string): boolean {
  const name = branchName.trim();
  return commit.refs.some((ref) => normalizeRefLabel(ref) === name);
}
