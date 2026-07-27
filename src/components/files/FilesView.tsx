import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "../../stores/appStore";
import * as api from "../../lib/api";
import { IconFiles } from "../Icons";

export function FilesView() {
  const activeRepoId = useAppStore((s) => s.activeRepoId);
  const [files, setFiles] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeRepoId) return;
    setLoading(true);
    void api
      .listRepoFiles(activeRepoId)
      .then((list) => {
        setFiles(list);
        setError(null);
      })
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [activeRepoId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return files;
    return files.filter((f) => f.toLowerCase().includes(q));
  }, [files, query]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
      <div className="flex shrink-0 items-center gap-2">
        <IconFiles className="text-text-muted" />
        <input
          className="h-8 flex-1 rounded border border-border bg-bg-secondary px-3 text-sm outline-none focus:border-primary"
          placeholder="Buscar arquivos rastreados…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="shrink-0 text-xs text-text-muted">{filtered.length} arquivos</span>
      </div>
      {loading && <p className="shrink-0 text-sm text-text-muted">Carregando…</p>}
      {error && <p className="shrink-0 text-sm text-danger">{error}</p>}
      <div className="min-h-0 flex-1 overflow-auto rounded border border-border bg-bg-secondary">
        {filtered.length === 0 && !loading ? (
          <p className="p-4 text-sm text-text-muted">Nenhum arquivo encontrado.</p>
        ) : (
          <ul className="divide-y divide-border/60 font-mono text-xs">
            {filtered.map((path) => (
              <li
                key={path}
                className="truncate px-3 py-1.5 text-text-muted hover:bg-surface hover:text-text"
                title={path}
              >
                {path}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
