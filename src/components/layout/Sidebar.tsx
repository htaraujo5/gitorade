import { BrandMark } from "../BrandMark";
import { useAppStore, type AppView } from "../../stores/appStore";
import { useT, type MessageKey } from "../../i18n";
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

const mainNav: { id: AppView; labelKey: MessageKey; icon: ReactNode }[] = [
  { id: "dashboard", labelKey: "nav.dashboard", icon: <IconDashboard /> },
  { id: "repositories", labelKey: "nav.repositories", icon: <IconRepos /> },
  { id: "favorites", labelKey: "nav.favorites", icon: <IconStar /> },
  { id: "history", labelKey: "nav.history", icon: <IconHistory /> },
];

const settingsNav: { id: AppView; labelKey: MessageKey; icon: ReactNode }[] = [
  { id: "credentials", labelKey: "nav.credentials", icon: <IconCredentials /> },
  { id: "ssh", labelKey: "nav.ssh", icon: <IconKey /> },
  { id: "settings", labelKey: "nav.preferences", icon: <IconSettings /> },
  { id: "plugins", labelKey: "nav.plugins", icon: <IconPlugins /> },
  { id: "about", labelKey: "nav.about", icon: <IconAbout /> },
];

export function Sidebar() {
  const t = useT();
  const { appView, setAppView, health } = useAppStore();

  return (
    <aside
      aria-label={t("nav.main")}
      className="flex h-full min-h-0 w-[220px] shrink-0 flex-col border-r border-[#2d3139] bg-[#1c1f26]"
    >
      <div className="border-b border-[#2d3139] px-3 py-3.5">
        <BrandMark compact />
      </div>

      <nav className="flex-1 overflow-auto px-2 py-3 text-[12px]" aria-label={t("nav.primary")}>
        <div className="space-y-0.5">
          {mainNav.map((item) => (
            <NavItem
              key={item.id}
              label={t(item.labelKey)}
              icon={item.icon}
              active={appView === item.id}
              onClick={() => setAppView(item.id)}
            />
          ))}
        </div>

        <div className="mb-1.5 mt-5 px-2.5 text-[9px] font-medium uppercase tracking-[0.1em] text-[#5c6370]">
          {t("nav.settingsSection")}
        </div>
        <div className="space-y-0.5">
          {settingsNav.map((item) => (
            <NavItem
              key={item.id}
              label={t(item.labelKey)}
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
      <span className="shrink-0 opacity-90">{icon}</span>
      {label}
    </button>
  );
}
