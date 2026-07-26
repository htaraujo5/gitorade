import { BrandMark } from "../BrandMark";
import { useAppStore, type AppView } from "../../stores/appStore";
import {
  IconAbout,
  IconCredentials,
  IconDashboard,
  IconHistory,
  IconKey,
  IconPlugins,
  IconRepos,
  IconSettings,
  IconStar,
} from "../Icons";
import type { ReactNode } from "react";

const mainNav: { id: AppView; label: string; icon: ReactNode }[] = [
  { id: "dashboard", label: "Dashboard", icon: <IconDashboard /> },
  { id: "repositories", label: "Repositórios", icon: <IconRepos /> },
  { id: "favorites", label: "Favoritos", icon: <IconStar /> },
  { id: "history", label: "Histórico", icon: <IconHistory /> },
];

const settingsNav: { id: AppView; label: string; icon: ReactNode }[] = [
  { id: "credentials", label: "Credenciais", icon: <IconCredentials /> },
  { id: "ssh", label: "SSH Keys", icon: <IconKey /> },
  { id: "settings", label: "Preferências", icon: <IconSettings /> },
  { id: "plugins", label: "Plugins", icon: <IconPlugins /> },
  { id: "about", label: "Sobre", icon: <IconAbout /> },
];

export function Sidebar() {
  const { appView, setAppView, health } = useAppStore();

  return (
    <aside
      aria-label="Navegação principal"
      className="flex w-[220px] shrink-0 flex-col border-r border-[#2d3139] bg-[#1c1f26]"
    >
      <div className="border-b border-[#2d3139] px-3 py-3.5">
        <BrandMark compact />
      </div>

      <nav className="flex-1 overflow-auto px-2 py-3 text-[12px]" aria-label="Principal">
        <div className="space-y-0.5">
          {mainNav.map((item) => (
            <NavItem
              key={item.id}
              label={item.label}
              icon={item.icon}
              active={appView === item.id}
              onClick={() => setAppView(item.id)}
            />
          ))}
        </div>

        <div className="mb-1.5 mt-5 px-2.5 text-[9px] font-medium uppercase tracking-[0.1em] text-[#5c6370]">
          Configurações
        </div>
        <div className="space-y-0.5">
          {settingsNav.map((item) => (
            <NavItem
              key={item.id}
              label={item.label}
              icon={item.icon}
              active={appView === item.id}
              onClick={() => setAppView(item.id)}
            />
          ))}
        </div>
      </nav>

      <div className="border-t border-[#2d3139] px-3 py-2.5 text-[10px] text-[#5c6370]">
        v{health?.appVersion ?? "0.1.0"}
      </div>
    </aside>
  );
}

function NavItem({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-left transition ${
        active
          ? "bg-[#1e3a5f] text-[#e8eaed]"
          : "text-[#8b909a] hover:bg-[#252830] hover:text-[#d8dbe2]"
      }`}
    >
      <span className="opacity-90">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}
