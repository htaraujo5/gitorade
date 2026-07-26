import type { ReactNode } from "react";
import { useAppStore } from "../../stores/appStore";
import { GraphView } from "../history/GraphView";
import { BranchesView } from "../history/BranchesView";
import { StashView } from "../history/StashView";
import { FilesView } from "../files/FilesView";
import { DiffViewer } from "../diff/DiffViewer";
import { CommitFileView } from "../diff/CommitFileView";
import { MergeConflictView } from "../diff/MergeConflictView";
import { BranchSidebar } from "./BranchSidebar";
import { StagingPanel } from "./StagingPanel";
import { ConflictSidePanel } from "./ConflictSidePanel";
import { CommitDetailsPanel } from "./CommitDetailsPanel";
import { ConflictBanner } from "../ConflictBanner";
import { TerminalPanel } from "../TerminalPanel";

/**
 * GitKraken-inspired workspace:
 * [branches] | [graph / conflict-editor / commit-file / wd-diff + terminal] | [staging / conflict / details]
 */
export function MainWorkspace() {
  const {
    workspaceTab,
    setWorkspaceTab,
    activeRepoId,
    repositories,
    selectedCommitHash,
    selectedCommitFile,
    selectedFile,
    diffText,
    status,
    selectFile,
    terminalOpen,
    conflictPath,
  } = useAppStore();

  const repo = repositories.find((r) => r.id === activeRepoId);
  if (!repo) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-[#8b909a]">
        Selecione um repositório no Dashboard.
      </div>
    );
  }

  const hasIntegrate =
    Boolean(status?.inProgress) || (status?.conflicts?.length ?? 0) > 0;
  const showConflictEditor = Boolean(conflictPath);
  const showCommitFile = Boolean(selectedCommitHash && selectedCommitFile);
  const showWdFile =
    Boolean(selectedFile) &&
    selectedCommitHash === null &&
    (workspaceTab === "graph" || workspaceTab === "changes");

  let center: ReactNode;
  if (showConflictEditor) center = <MergeConflictView />;
  else if (workspaceTab === "branches") center = <BranchesView />;
  else if (workspaceTab === "stash") center = <StashView />;
  else if (workspaceTab === "files") center = <FilesView />;
  else if (showCommitFile) center = <CommitFileView />;
  else if (workspaceTab === "changes" || showWdFile) {
    center = (
      <div className="flex min-h-0 flex-1 flex-col bg-[#171a20]">
        <div className="flex items-center gap-2 border-b border-[#2d3139] bg-[#1c1f26] px-3 py-1.5 text-[11px]">
          <button
            type="button"
            className="text-[#3d8bfd] hover:underline"
            onClick={() => void selectFile(null)}
          >
            ← Graph
          </button>
          <span className="truncate text-[#6b7280]">
            {selectedFile ? selectedFile.path : "Diff"}
          </span>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-2 p-2">
          <DiffViewer
            selectedFile={selectedFile}
            diffText={diffText}
            stagedCount={status?.staged.length ?? 0}
            unstagedCount={status?.unstaged.length ?? 0}
          />
        </div>
      </div>
    );
  } else {
    center = <GraphView />;
  }

  let right: ReactNode;
  if (hasIntegrate) right = <ConflictSidePanel />;
  else if (selectedCommitHash) right = <CommitDetailsPanel />;
  else right = <StagingPanel />;

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#171a20]">
      <div className="shrink-0 px-2 pt-1 empty:hidden">
        <ConflictBanner />
      </div>

      {(workspaceTab === "branches" ||
        workspaceTab === "stash" ||
        workspaceTab === "files") &&
        !showConflictEditor && (
        <div className="flex items-center gap-2 border-b border-[#2d3139] bg-[#1c1f26] px-3 py-1.5 text-[11px]">
          <button
            type="button"
            className="text-[#3d8bfd] hover:underline"
            onClick={() => setWorkspaceTab("graph")}
          >
            ← Graph
          </button>
          <span className="text-[#8b909a]">
            {workspaceTab === "branches"
              ? "Branches"
              : workspaceTab === "stash"
                ? "Stash"
                : "Files"}
          </span>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <BranchSidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{center}</div>
          {terminalOpen && <TerminalPanel />}
        </div>
        {right}
      </div>
    </section>
  );
}
