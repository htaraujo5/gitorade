import type { RemoteInfo } from "./api";
import { normalizeRefLabel } from "./branchGraph";

export type RefPillKind = "local" | "remote" | "tag";

export type GraphRefPill = {
  /** Stable React key */
  key: string;
  /** Short label shown in the pill */
  label: string;
  /** Original decorate string used for checkout / selection */
  primaryRef: string;
  isTag: boolean;
  isLocal: boolean;
  /** Remote short name when this tip exists on a remote (e.g. "origin") */
  remoteName: string | null;
  isHead: boolean;
};

function remoteNamesSorted(remotes: Pick<RemoteInfo, "name">[]): string[] {
  return remotes
    .map((r) => r.name)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
}

/** Classify a single decorate label after normalize. */
export function classifyNormalizedRef(
  short: string,
  remotes: Pick<RemoteInfo, "name">[],
): { kind: RefPillKind; branchLabel: string; remoteName: string | null } {
  for (const remote of remoteNamesSorted(remotes)) {
    if (short === remote) {
      return { kind: "remote", branchLabel: remote, remoteName: remote };
    }
    const prefix = `${remote}/`;
    if (short.startsWith(prefix)) {
      return {
        kind: "remote",
        branchLabel: short.slice(prefix.length),
        remoteName: remote,
      };
    }
  }
  return { kind: "local", branchLabel: short, remoteName: null };
}

function isTagDecorate(raw: string): boolean {
  const s = raw.trim();
  return s.startsWith("tag: ") || s.startsWith("refs/tags/");
}

/**
 * Merge local + remote tips that share a short branch name into one pill
 * (GitKraken-style: one label with laptop + cloud icons).
 */
export function groupRefsForCommit(
  refs: string[],
  remotes: Pick<RemoteInfo, "name">[],
): GraphRefPill[] {
  const byKey = new Map<string, GraphRefPill>();
  const order: string[] = [];

  for (const raw of refs) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    // Detached HEAD: git decorate is a bare "HEAD" (not "HEAD -> branch").
    if (trimmed === "HEAD") {
      const key = "head:detached";
      if (!byKey.has(key)) {
        byKey.set(key, {
          key,
          label: "HEAD",
          primaryRef: "HEAD",
          isTag: false,
          isLocal: true,
          remoteName: null,
          isHead: true,
        });
        order.push(key);
      }
      continue;
    }

    const isHead = /^HEAD\s*->/.test(trimmed);
    const short = normalizeRefLabel(trimmed);
    if (!short) continue;

    if (isTagDecorate(trimmed) || trimmed.includes("refs/tags/")) {
      const key = `tag:${short}`;
      if (!byKey.has(key)) {
        byKey.set(key, {
          key,
          label: short,
          primaryRef: trimmed,
          isTag: true,
          isLocal: false,
          remoteName: null,
          isHead: false,
        });
        order.push(key);
      }
      continue;
    }

    const { kind, branchLabel, remoteName } = classifyNormalizedRef(short, remotes);
    const key = kind === "remote" || kind === "local" ? `branch:${branchLabel}` : `other:${short}`;

    const existing = byKey.get(key);
    if (existing) {
      if (kind === "local") {
        existing.isLocal = true;
        if (isHead) existing.isHead = true;
        // Prefer local ref for checkout
        existing.primaryRef = trimmed;
      } else if (kind === "remote") {
        existing.remoteName = remoteName ?? existing.remoteName;
      }
      continue;
    }

    byKey.set(key, {
      key,
      label: branchLabel,
      primaryRef: trimmed,
      isTag: false,
      isLocal: kind === "local",
      remoteName: kind === "remote" ? remoteName : null,
      isHead,
    });
    order.push(key);
  }

  return order.map((k) => byKey.get(k)!).filter(Boolean);
}

/** Whether any configured remote looks like GitHub (for icon choice). */
export function remotesLookLikeGithub(
  remotes: Pick<RemoteInfo, "fetchUrl" | "pushUrl">[],
): boolean {
  return remotes.some((r) => {
    const url = `${r.fetchUrl ?? ""} ${r.pushUrl ?? ""}`.toLowerCase();
    return url.includes("github.com") || url.includes("github:");
  });
}
