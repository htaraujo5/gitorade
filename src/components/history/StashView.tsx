import { useState } from "react";
import { useAppStore } from "../../stores/appStore";

function relativeTime(iso?: string | null): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(mins, 1)} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.floor(hours / 24)} d`;
}

export function StashView() {
  const { stash, createStash, applyStash, dropStash, busy } = useAppStore();
  const [message, setMessage] = useState("");

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void createStash(message.trim() || undefined);
          setMessage("");
        }}
      >
        <input
          className="flex-1 rounded-[var(--radius-sm)] border border-border bg-bg-secondary px-3 py-1.5 text-sm outline-none focus:border-primary"
          placeholder="Mensagem do stash (opcional)"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <button
          type="submit"
          disabled={busy}
          className="brand-gradient rounded-[var(--radius-sm)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
        >
          Stash push
        </button>
      </form>

      <div className="min-h-0 flex-1 overflow-auto rounded-[var(--radius-md)] border border-border bg-bg-secondary">
        {stash.length === 0 ? (
          <div className="p-6 text-sm text-text-muted">Nenhum stash.</div>
        ) : (
          <ul>
            {stash.map((entry) => (
              <li
                key={entry.selector}
                className="flex items-center gap-3 border-b border-border/60 px-3 py-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{entry.message || entry.selector}</div>
                  <div className="mt-0.5 text-[11px] text-text-muted">
                    {entry.selector}
                    {entry.authoredAt ? ` · ${relativeTime(entry.authoredAt)}` : ""}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  className="text-xs text-primary disabled:opacity-40"
                  onClick={() => void applyStash(entry.selector, false)}
                >
                  Apply
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="text-xs text-primary disabled:opacity-40"
                  onClick={() => void applyStash(entry.selector, true)}
                >
                  Pop
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="text-xs text-danger disabled:opacity-40"
                  onClick={() => {
                    if (window.confirm(`Remover ${entry.selector}?`)) {
                      void dropStash(entry.selector);
                    }
                  }}
                >
                  Drop
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
