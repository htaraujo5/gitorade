import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAppStore } from "../../stores/appStore";
import { UserAvatar } from "../UserAvatar";

/** GitKraken-style profile menu: identity lives here, not in the commit form. */
export function ProfileMenu() {
  const {
    profiles,
    commitOverrideProfileId,
    setCommitOverrideProfileId,
    associateProfile,
    setAppView,
    repositories,
    activeRepoId,
  } = useAppStore();

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const repo = repositories.find((r) => r.id === activeRepoId);
  const active =
    profiles.find((p) => p.id === commitOverrideProfileId) ??
    repo?.activeProfile ??
    profiles[0] ??
    null;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded px-1.5 py-1 text-left hover:bg-[#2a2e38] ${
          open ? "bg-[#2a2e38]" : ""
        }`}
      >
        <Avatar name={active?.name ?? "?"} email={active?.email} src={active?.avatarData} size={22} />
        <span className="max-w-[110px] truncate text-[11px] font-normal text-[#d8dbe2]">
          {active?.name ?? "Profile"}
        </span>
        <ChevronDown />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-[280px] overflow-hidden rounded-md border border-[#3a3f4b] bg-[#252830] shadow-2xl shadow-black/50">
          <Section title="Current profile">
            {profiles.length === 0 ? (
              <p className="px-3 py-2 text-[11px] text-[#8b909a]">
                Nenhum perfil. Crie um em Credenciais.
              </p>
            ) : (
              profiles.map((p) => {
                const selected = p.id === active?.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-[#2f3440] ${
                      selected ? "bg-[#1e3a5f]" : ""
                    }`}
                    onClick={() => {
                      setCommitOverrideProfileId(p.id);
                      // Persist as repo default when a repo is open (optional convenience)
                      if (activeRepoId) void associateProfile(p.id);
                      setOpen(false);
                    }}
                  >
                    <Avatar name={p.name} email={p.email} src={p.avatarData} size={26} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-medium text-[#f0f1f4]">
                        {p.name}
                      </div>
                      <div className="truncate text-[10px] text-[#8b909a]">{p.email}</div>
                    </div>
                    {selected && <span className="text-[10px] text-[#3dd68c]">✓</span>}
                  </button>
                );
              })
            )}
          </Section>

          <Section title="Commit signature">
            <div className="px-3 py-2">
              <div className="text-[12px] text-[#f0f1f4]">{active?.name ?? "—"}</div>
              <div className="truncate text-[11px] text-[#8b909a]">
                {active?.email ?? "sem email"}
              </div>
            </div>
          </Section>

          <Section title="Account">
            <MenuItem
              label="Manage profiles"
              onClick={() => {
                setOpen(false);
                setAppView("credentials");
              }}
            />
            <MenuItem
              label="Preferências"
              onClick={() => {
                setOpen(false);
                setAppView("settings");
              }}
            />
            <MenuItem
              label="Sobre o Gitorade"
              onClick={() => {
                setOpen(false);
                setAppView("about");
              }}
            />
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-b border-[#3a3f4b] last:border-b-0">
      <div className="px-3 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wide text-[#8b909a]">
        {title}
      </div>
      {children}
    </div>
  );
}

function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center px-3 py-2 text-left text-[12px] text-[#e8eaed] hover:bg-[#2f3440]"
    >
      {label}
    </button>
  );
}

function Avatar({
  name,
  email,
  src,
  size,
}: {
  name: string;
  email?: string | null;
  src?: string | null;
  size: number;
}) {
  return (
    <UserAvatar name={name} email={email} src={src} size={size} rounded="sm" gradientFallback />
  );
}

function ChevronDown() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" className="text-[#8b909a]" aria-hidden>
      <path fill="currentColor" d="M4 6l4 4 4-4H4z" />
    </svg>
  );
}
