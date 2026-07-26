import type { ReactNode } from "react";
import { useAppStore, type ShellTab } from "../../stores/appStore";
import { IconBranch, IconClose, IconDashboard, IconKey, IconPlus, IconRepos, IconPlugins, IconSettings } from "../Icons";
import { ProfileMenu } from "./ProfileMenu";

/** Top chrome: open tabs + global actions (GitKraken-style). */
export function TabBar() {
  const {
    shellTabs,
    activeShellTabId,
    activateShellTab,
    closeShellTab,
    openStartTab,
    openSettingsTab,
    openRepositoryDialog,
  } = useAppStore();

  return (
    <div className="relative z-50 flex h-9 shrink-0 items-stretch border-b border-[#2d3139] bg-[#14161c]">
      <div className="flex shrink-0 items-center gap-0.5 px-1.5">
        <IconBtn title="Abrir repositório" onClick={() => void openRepositoryDialog()}>
          <IconRepos className="h-3.5 w-3.5" />
        </IconBtn>
        <IconBtn title="Start" onClick={() => openStartTab()}>
          <IconDashboard className="h-3.5 w-3.5" />
        </IconBtn>
      </div>

      <div className="flex min-w-0 flex-1 items-stretch gap-0.5 overflow-x-auto px-0.5">
        {shellTabs.map((tab) => (
          <ShellTabChip
            key={tab.id}
            tab={tab}
            active={tab.id === activeShellTabId}
            onActivate={() => void activateShellTab(tab.id)}
            onClose={() => closeShellTab(tab.id)}
          />
        ))}
        <button
          type="button"
          title="Nova aba"
          className="flex w-7 shrink-0 items-center justify-center text-[#6b7280] hover:bg-[#1c1f26] hover:text-[#d8dbe2]"
          onClick={() => openStartTab()}
        >
          <IconPlus className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-0.5 border-l border-[#2d3139] px-1.5">
        <IconBtn title="Preferências" onClick={() => openSettingsTab()}>
          <IconSettings className="h-3.5 w-3.5" />
        </IconBtn>
        <ProfileMenu />
      </div>
    </div>
  );
}

function ShellTabChip({
  tab,
  active,
  onActivate,
  onClose,
}: {
  tab: ShellTab;
  active: boolean;
  onActivate: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className={`group flex max-w-[180px] items-stretch ${
        active
          ? "bg-[#1c1f26] text-[#e8eaed]"
          : "text-[#8b909a] hover:bg-[#1a1d24] hover:text-[#c5c9d2]"
      }`}
    >
      <button
        type="button"
        onClick={onActivate}
        className="flex min-w-0 flex-1 items-center gap-1.5 px-2.5 text-left"
      >
        <TabIcon kind={tab.kind} />
        <span className="min-w-0 truncate text-[11px] font-normal">{tab.title}</span>
      </button>
      <button
        type="button"
        title="Fechar aba"
        className={`flex w-6 shrink-0 items-center justify-center opacity-0 group-hover:opacity-100 ${
          active ? "opacity-70 hover:text-white" : "hover:text-[#e8eaed]"
        }`}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        <IconClose className="h-3 w-3" />
      </button>
    </div>
  );
}

function TabIcon({ kind }: { kind: ShellTab["kind"] }) {
  if (kind === "repo") return <IconBranch className="h-3 w-3 text-[#3dd68c]" />;
  if (kind === "settings") return <IconSettings className="h-3 w-3" />;
  if (kind === "start") return <IconDashboard className="h-3 w-3" />;
  if (kind === "ssh") return <IconKey className="h-3 w-3" />;
  if (kind === "plugins") return <IconPlugins className="h-3 w-3" />;
  return <IconRepos className="h-3 w-3" />;
}

function IconBtn({
  children,
  title,
  onClick,
}: {
  children: ReactNode;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="rounded p-1.5 text-[#8b909a] hover:bg-[#252830] hover:text-[#e8eaed]"
    >
      {children}
    </button>
  );
}
