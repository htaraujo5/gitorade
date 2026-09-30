import { useEffect, useMemo, useState } from "react";
import * as api from "../lib/api";
import type { BlameLine, FileHistoryEntry } from "../lib/api";
import { parseUnifiedDiff } from "../lib/diffParse";
import { useAppStore } from "../stores/appStore";
import { UnifiedView } from "./diff/DiffViewer";

type Loadable<T> = { loading: boolean; error: string | null; data: T };

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function shortDate(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  return new Date(t).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

/** File history (log --follow) and blame, opened from the staging list or commit file view. */
export function FileInspectorModal() {
  const inspector = useAppStore((s) => s.fileInspector);
  const close = useAppStore((s) => s.closeFileInspector);
  const open = useAppStore((s) => s.openFileInspector);
  const repoId = useAppStore((s) => s.activeRepoId);
  const selectCommit = useAppStore((s) => s.selectCommit);

  useEffect(() => {
    if (!inspector) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [inspector, close]);

  if (!inspector || !repoId) return null;

  const goToCommit = (hash: string) => {
    close();
    void selectCommit(hash);
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gitorade-inspector-title"
      onClick={close}
    >
      <div
        className="flex h-[min(760px,90vh)] w-[min(1100px,95vw)] flex-col overflow-hidden rounded-lg border border-[#3a3f4b] bg-[#1c1f26] shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-[#2d3139] px-4 py-2.5">
          <div className="flex rounded border border-[#2d3139] p-px text-[11px]">
            {(["history", "blame"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => open(inspector.path, { rev: inspector.rev, mode: m })}
                className={`rounded px-2.5 py-1 ${
                  inspector.mode === m
                    ? "bg-[#a371f7]/20 text-[#e8eaed]"
                    : "text-[#8b909a] hover:text-[#e8eaed]"
                }`}
              >
                {m === "history" ? "Histórico" : "Blame"}
              </button>
            ))}
          </div>
          <h2
            id="gitorade-inspector-title"
            className="min-w-0 flex-1 truncate font-mono text-[12px] text-[#e8eaed]"
            title={inspector.path}
          >
            {inspector.path}
            {inspector.mode === "blame" && inspector.rev ? (
              <span className="text-[#6b7280]"> @ {inspector.rev.slice(0, 7)}</span>
            ) : null}
          </h2>
          <button
            type="button"
            className="rounded px-1.5 text-[18px] leading-none text-[#6b7280] hover:bg-[#252830] hover:text-[#e8eaed]"
            onClick={close}
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        {inspector.mode === "history" ? (
          <HistoryPane
            key={`h-${inspector.path}`}
            repoId={repoId}
            path={inspector.path}
            onGoToCommit={goToCommit}
            onBlameAt={(hash, path) => open(path, { rev: hash, mode: "blame" })}
          />
        ) : (
          <BlamePane
            key={`b-${inspector.path}-${inspector.rev ?? ""}`}
            repoId={repoId}
            path={inspector.path}
            rev={inspector.rev}
            onGoToCommit={goToCommit}
          />
        )}
      </div>
    </div>
  );
}

function HistoryPane({
  repoId,
  path,
  onGoToCommit,
  onBlameAt,
}: {
  repoId: string;
  path: string;
  onGoToCommit: (hash: string) => void;
  onBlameAt: (hash: string, path: string) => void;
}) {
  const [list, setList] = useState<Loadable<FileHistoryEntry[]>>({
    loading: true,
    error: null,
    data: [],
  });
  const [selected, setSelected] = useState<FileHistoryEntry | null>(null);
  const [diff, setDiff] = useState<Loadable<string>>({ loading: false, error: null, data: "" });

  useEffect(() => {
    let alive = true;
    api
      .getFileHistory(repoId, path)
      .then((data) => {
        if (!alive) return;
        setList({ loading: false, error: null, data });
        setSelected(data[0] ?? null);
      })
      .catch((err) => alive && setList({ loading: false, error: errMsg(err), data: [] }));
    return () => {
      alive = false;
    };
  }, [repoId, path]);

  useEffect(() => {
    if (!selected) return;
    let alive = true;
    setDiff({ loading: true, error: null, data: "" });
    api
      .getCommitFileDiff(repoId, selected.hash, selected.path)
      .then((data) => alive && setDiff({ loading: false, error: null, data }))
      .catch((err) => alive && setDiff({ loading: false, error: errMsg(err), data: "" }));
    return () => {
      alive = false;
    };
  }, [repoId, selected]);

  const rows = useMemo(() => parseUnifiedDiff(diff.data), [diff.data]);

  return (
    <div className="flex min-h-0 flex-1">
      <ul className="w-[340px] shrink-0 overflow-auto border-r border-[#2d3139]">
        {list.loading && <li className="px-3 py-3 text-[12px] text-[#6b7280]">Carregando…</li>}
        {list.error && <li className="px-3 py-3 text-[12px] text-[#f85149]">{list.error}</li>}
        {!list.loading && !list.error && list.data.length === 0 && (
          <li className="px-3 py-3 text-[12px] text-[#6b7280]">Nenhum commit para este arquivo.</li>
        )}
        {list.data.map((entry) => {
          const active = selected?.hash === entry.hash;
          return (
            <li key={entry.hash}>
              <button
                type="button"
                onClick={() => setSelected(entry)}
                className={`block w-full border-b border-[#2d3139]/60 px-3 py-2 text-left ${
                  active ? "bg-[#1e3a5f]" : "hover:bg-[#252830]"
                }`}
              >
                <div className="truncate text-[12px] text-[#e8eaed]">{entry.subject}</div>
                <div className="mt-0.5 flex items-center gap-2 text-[10px] text-[#6b7280]">
                  <span className="font-mono text-[#a371f7]">{entry.shortHash}</span>
                  <span className="truncate">{entry.authorName}</span>
                  <span className="ml-auto shrink-0">{shortDate(entry.authoredAt)}</span>
                  <span className="shrink-0 font-mono">{entry.status.charAt(0) || "M"}</span>
                </div>
                {entry.path !== path && (
                  <div className="mt-0.5 truncate font-mono text-[10px] text-[#5c6370]">
                    {entry.path}
                  </div>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex min-w-0 flex-1 flex-col">
        {selected && (
          <div className="flex items-center gap-2 border-b border-[#2d3139] px-3 py-1.5 text-[11px]">
            <span className="font-mono text-[#a371f7]">{selected.shortHash}</span>
            <span className="min-w-0 flex-1 truncate text-[#c8ccd4]">{selected.subject}</span>
            {!selected.status.startsWith("D") && (
              <button
                type="button"
                className="rounded border border-[#2d3139] px-2 py-0.5 text-[#c8ccd4] hover:bg-[#252830]"
                onClick={() => onBlameAt(selected.hash, selected.path)}
              >
                Blame nesta versão
              </button>
            )}
            <button
              type="button"
              className="rounded border border-[#2d3139] px-2 py-0.5 text-[#c8ccd4] hover:bg-[#252830]"
              onClick={() => onGoToCommit(selected.hash)}
            >
              Ver no grafo
            </button>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-auto bg-[#0d1117]">
          {diff.loading ? (
            <p className="p-4 text-[12px] text-[#6b7280]">Carregando diff…</p>
          ) : diff.error ? (
            <p className="p-4 text-[12px] text-[#f85149]">{diff.error}</p>
          ) : !selected ? null : diff.data.trim() === "" ? (
            <p className="p-4 text-[12px] text-[#6b7280]">Sem diff textual (arquivo binário?).</p>
          ) : (
            <UnifiedView rows={rows} />
          )}
        </div>
      </div>
    </div>
  );
}

function BlamePane({
  repoId,
  path,
  rev,
  onGoToCommit,
}: {
  repoId: string;
  path: string;
  rev: string | null;
  onGoToCommit: (hash: string) => void;
}) {
  const [state, setState] = useState<Loadable<BlameLine[]>>({
    loading: true,
    error: null,
    data: [],
  });

  useEffect(() => {
    let alive = true;
    api
      .getFileBlame(repoId, path, rev)
      .then((data) => alive && setState({ loading: false, error: null, data }))
      .catch((err) => alive && setState({ loading: false, error: errMsg(err), data: [] }));
    return () => {
      alive = false;
    };
  }, [repoId, path, rev]);

  if (state.loading) return <p className="p-4 text-[12px] text-[#6b7280]">Carregando blame…</p>;
  if (state.error) return <p className="p-4 text-[12px] text-[#f85149]">{state.error}</p>;
  if (state.data.length === 0) {
    return <p className="p-4 text-[12px] text-[#6b7280]">Arquivo vazio.</p>;
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-[#0d1117] font-mono text-[12px] leading-5">
      {state.data.map((line, i) => {
        const first = i === 0 || state.data[i - 1].hash !== line.hash;
        const uncommitted = /^0+$/.test(line.hash);
        return (
          <div
            key={line.line}
            className={`flex ${first && i > 0 ? "border-t border-[#2d3139]/70" : ""}`}
          >
            <div className="w-[300px] shrink-0 truncate border-r border-[#2d3139] px-2 text-[11px]">
              {first ? (
                <button
                  type="button"
                  disabled={uncommitted}
                  onClick={() => onGoToCommit(line.hash)}
                  title={`${line.summary}\n${line.authorName} <${line.authorEmail}>\n${line.authoredAt}`}
                  className="flex w-full items-center gap-2 text-left hover:text-[#e8eaed] disabled:cursor-default"
                >
                  <span className={uncommitted ? "text-[#e3b341]" : "text-[#a371f7]"}>
                    {uncommitted ? "working" : line.shortHash}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[#8b909a]">{line.authorName}</span>
                  <span className="shrink-0 text-[#5c6370]">
                    {uncommitted ? "" : shortDate(line.authoredAt)}
                  </span>
                </button>
              ) : null}
            </div>
            <span className="w-12 shrink-0 select-none px-2 text-right text-[#484f58]">
              {line.line}
            </span>
            <span className="min-w-0 flex-1 whitespace-pre pr-4 text-[#c8ccd4]">
              {line.content || " "}
            </span>
          </div>
        );
      })}
    </div>
  );
}
