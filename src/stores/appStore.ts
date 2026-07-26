import { create } from "zustand";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import type {
  AppHealth,
  BranchInfo,
  CommitGraph,
  CommitResult,
  CommitSummary,
  CreateProfileInput,
  FileChange,
  Profile,
  RemoteInfo,
  RepoStatus,
  Repository,
  StashEntry,
} from "../lib/api";
import * as api from "../lib/api";
import { progressEventSchema } from "../lib/api";
import { usePrefsStore } from "./prefsStore";

type WorkspaceTab = "graph" | "commits" | "changes" | "branches" | "stash" | "files";
type AppView =
  | "dashboard"
  | "repositories"
  | "favorites"
  | "history"
  | "credentials"
  | "ssh"
  | "settings"
  | "plugins"
  | "about";

/** GitKraken-style shell tabs (repos + Start + settings pages). */
export type ShellTabKind =
  | "start"
  | "repo"
  | "settings"
  | "credentials"
  | "about"
  | "ssh"
  | "plugins";

export type ShellTab = {
  id: string;
  kind: ShellTabKind;
  repoId?: string;
  title: string;
};

export type { WorkspaceTab, AppView };

const START_TAB: ShellTab = { id: "tab-start", kind: "start", title: "Start" };

function tabIdFor(kind: ShellTabKind, repoId?: string): string {
  if (kind === "repo" && repoId) return `tab-repo-${repoId}`;
  return `tab-${kind}`;
}

function appViewForTab(tab: ShellTab): AppView {
  if (tab.kind === "repo") return "history";
  if (tab.kind === "start") return "dashboard";
  return tab.kind;
}

type SelectedFile = {
  path: string;
  staged: boolean;
};

type OperationKind = "clone" | "fetch" | "pull" | "push";

type ActiveOperation = {
  id: string;
  kind: OperationKind;
  label: string;
  percent: number | null;
  lines: string[];
  done: boolean;
  success: boolean | null;
};

type AppState = {
  health: AppHealth | null;
  bootLoading: boolean;
  bootError: string | null;

  repositories: Repository[];
  activeRepoId: string | null;
  profiles: Profile[];
  status: RepoStatus | null;
  selectedFile: SelectedFile | null;
  diffText: string;
  commitMessage: string;
  commitOverrideProfileId: string | null;
  lastCommit: CommitResult | null;

  workspaceTab: WorkspaceTab;
  appView: AppView;
  shellTabs: ShellTab[];
  activeShellTabId: string | null;
  selectedCommitHash: string | null;
  selectedCommitFile: string | null;
  commitFileContent: string;
  commitFileViewMode: "diff" | "file";
  commitFiles: { status: string; path: string }[];
  busy: boolean;
  openingRepoName: string | null;
  notice: string | null;
  error: string | null;

  remotes: RemoteInfo[];
  operation: ActiveOperation | null;

  graph: CommitGraph | null;
  commitQuery: string;
  commitSearchOpen: boolean;
  filteredCommits: CommitSummary[] | null;
  branches: BranchInfo[];
  stash: StashEntry[];
  branchFilter: string;
  selectedBranchName: string | null;

  bootstrap: () => Promise<void>;
  refreshRepositories: () => Promise<void>;
  refreshProfiles: () => Promise<void>;
  openRepositoryDialog: () => Promise<void>;
  initRepositoryDialog: () => Promise<void>;
  cloneRepository: (url: string) => Promise<void>;
  selectRepository: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  removeRepository: (id: string) => Promise<void>;
  refreshStatus: () => Promise<void>;
  refreshRemotes: () => Promise<void>;
  refreshHistory: () => Promise<void>;
  refreshBranches: () => Promise<void>;
  refreshStash: () => Promise<void>;
  setCommitQuery: (query: string) => void;
  setCommitSearchOpen: (open: boolean) => void;
  searchCommits: () => Promise<void>;
  clearCommitSearch: () => Promise<void>;
  setBranchFilter: (query: string) => void;
  setSelectedBranchName: (name: string | null) => void;
  createBranch: (name: string, checkout?: boolean) => Promise<void>;
  checkoutBranch: (name: string) => Promise<void>;
  renameBranch: (oldName: string, newName: string) => Promise<void>;
  deleteBranch: (name: string, force?: boolean) => Promise<void>;
  mergeBranch: (name: string) => Promise<void>;
  rebaseOnto: (upstream: string) => Promise<void>;
  cherryPick: (commit: string) => Promise<void>;
  abortIntegrate: () => Promise<void>;
  continueIntegrate: () => Promise<void>;
  resolveConflict: (
    path: string,
    strategy: "ours" | "theirs" | "content",
    content?: string,
  ) => Promise<void>;
  loadConflictFile: (path: string) => Promise<string>;
  conflictDraft: string;
  conflictPath: string | null;
  setConflictDraft: (value: string) => void;
  terminalOpen: boolean;
  setTerminalOpen: (open: boolean) => void;
  createStash: (message?: string) => Promise<void>;
  applyStash: (selector: string, pop?: boolean) => Promise<void>;
  dropStash: (selector: string) => Promise<void>;
  addRemote: (name: string, url: string) => Promise<void>;
  removeRemote: (name: string) => Promise<void>;
  stage: (paths: string[]) => Promise<void>;
  unstage: (paths: string[]) => Promise<void>;
  selectFile: (file: FileChange | null) => Promise<void>;
  setCommitMessage: (message: string) => void;
  setCommitOverrideProfileId: (id: string | null) => void;
  setWorkspaceTab: (tab: WorkspaceTab) => void;
  setAppView: (view: AppView) => void;
  openStartTab: () => void;
  openSettingsTab: () => void;
  openCredentialsTab: () => void;
  openAboutTab: () => void;
  openSshTab: () => void;
  openPluginsTab: () => void;
  activateShellTab: (id: string) => Promise<void>;
  closeShellTab: (id: string) => void;
  selectCommit: (hash: string | null) => Promise<void>;
  selectCommitFile: (path: string | null) => Promise<void>;
  setCommitFileViewMode: (mode: "diff" | "file") => void;
  navigateCommitFile: (dir: -1 | 1) => Promise<void>;
  openCommitFileInWorkingDir: () => Promise<void>;
  createProfile: (input: CreateProfileInput, opts?: { stay?: boolean }) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  associateProfile: (profileId: string | null) => Promise<void>;
  commit: () => Promise<void>;
  fetch: () => Promise<void>;
  pull: () => Promise<void>;
  push: () => Promise<void>;
  cancelOperation: () => Promise<void>;
  dismissOperation: () => void;
  clearNotice: () => void;
};

let progressListenerReady = false;
function newOperationId(): string {
  return `op-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export const useAppStore = create<AppState>((set, get) => ({
  health: null,
  bootLoading: true,
  bootError: null,
  repositories: [],
  activeRepoId: null,
  profiles: [],
  status: null,
  selectedFile: null,
  diffText: "",
  commitMessage: "",
  commitOverrideProfileId: null,
  lastCommit: null,
  workspaceTab: "graph",
  appView: "dashboard",
  shellTabs: [START_TAB],
  activeShellTabId: START_TAB.id,
  selectedCommitHash: null,
  selectedCommitFile: null,
  commitFileContent: "",
  commitFileViewMode: "diff",
  commitFiles: [],
  busy: false,
  openingRepoName: null,
  notice: null,
  error: null,
  remotes: [],
  operation: null,
  graph: null,
  commitQuery: "",
  commitSearchOpen: false,
  filteredCommits: null,
  branches: [],
  stash: [],
  branchFilter: "",
  selectedBranchName: null,
  conflictDraft: "",
  conflictPath: null,
  terminalOpen: false,

  clearNotice: () => set({ notice: null, error: null }),
  dismissOperation: () => set({ operation: null }),
  setCommitQuery: (query) => set({ commitQuery: query }),
  setCommitSearchOpen: (open) => set({ commitSearchOpen: open }),
  setBranchFilter: (query) => set({ branchFilter: query }),
  setSelectedBranchName: (name) => set({ selectedBranchName: name }),
  setConflictDraft: (value) => set({ conflictDraft: value }),
  setTerminalOpen: (open) => set({ terminalOpen: open }),

  bootstrap: async () => {
    set({ bootLoading: true, bootError: null });
    if (!progressListenerReady) {
      progressListenerReady = true;
      void listen("git://progress", (event) => {
        const parsed = progressEventSchema.safeParse(event.payload);
        if (!parsed.success) return;
        const p = parsed.data;
        const current = get().operation;
        if (!current || current.id !== p.operationId) return;
        set({
          operation: {
            ...current,
            percent: p.percent ?? current.percent,
            lines:
              p.stream === "system"
                ? current.lines
                : [...current.lines.slice(-200), p.message],
            done: p.done ? true : current.done,
            success: p.success ?? current.success,
          },
        });
      });
    }
    try {
      const health = await api.getAppHealth();
      set({ health });
      await Promise.all([get().refreshRepositories(), get().refreshProfiles()]);
      set({ bootLoading: false, appView: "dashboard", shellTabs: [START_TAB], activeShellTabId: START_TAB.id });
    } catch (err) {
      set({ bootLoading: false, bootError: errMsg(err) });
    }
  },

  refreshRepositories: async () => {
    const repositories = await api.listRepositories();
    set({ repositories });
  },

  refreshProfiles: async () => {
    const profiles = await api.listProfiles();
    set({ profiles });
  },

  openRepositoryDialog: async () => {
    set({ busy: true, error: null });
    try {
      const defaultPath = usePrefsStore.getState().projectsPath || undefined;
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Abrir repositório Git",
        defaultPath,
      });
      if (!selected || Array.isArray(selected)) {
        set({ busy: false });
        return;
      }
      const repo = await api.openRepository(selected);
      await get().refreshRepositories();
      await get().selectRepository(repo.id);
      set({ busy: false, notice: `Repositório aberto: ${repo.name}` });
    } catch (err) {
      set({ busy: false, error: errMsg(err) });
    }
  },

  selectRepository: async (id) => {
    const repo = get().repositories.find((r) => r.id === id);
    const title = repo?.name ?? "Repository";
    const tabId = tabIdFor("repo", id);
    const tabs = [...get().shellTabs];
    const idx = tabs.findIndex((t) => t.id === tabId);
    if (idx >= 0) {
      tabs[idx] = { ...tabs[idx], title, repoId: id };
    } else {
      tabs.push({ id: tabId, kind: "repo", repoId: id, title });
    }

    set({
      openingRepoName: title,
      activeRepoId: id,
      appView: "history",
      shellTabs: tabs,
      activeShellTabId: tabId,
      selectedFile: null,
      diffText: "",
      commitMessage: "",
      lastCommit: null,
      error: null,
      workspaceTab: "graph",
      remotes: [],
      graph: null,
      filteredCommits: null,
      branches: [],
      stash: [],
      commitQuery: "",
      branchFilter: "",
      selectedBranchName: null,
      selectedCommitHash: null,
      commitFiles: [],
      selectedCommitFile: null,
      commitFileContent: "",
      commitOverrideProfileId: repo?.defaultProfileId ?? null,
    });
    try {
      await Promise.all([
        get().refreshStatus(),
        get().refreshRemotes(),
        get().refreshHistory(),
        get().refreshBranches(),
        get().refreshStash(),
      ]);
      // Start on WIP (working tree), like GitKraken — not auto-selecting HEAD.
      set({
        selectedCommitHash: null,
        commitFiles: [],
        terminalOpen: usePrefsStore.getState().terminalOpenByDefault
          ? true
          : get().terminalOpen,
        openingRepoName: null,
      });
    } catch (err) {
      set({ openingRepoName: null, error: errMsg(err) });
    }
  },

  initRepositoryDialog: async () => {
    set({ busy: true, error: null });
    try {
      const defaultPath = usePrefsStore.getState().projectsPath || undefined;
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Escolher pasta para inicializar repositório",
        defaultPath,
      });
      if (!selected || Array.isArray(selected)) {
        set({ busy: false });
        return;
      }
      const repo = await api.initRepository(selected);
      await get().refreshRepositories();
      await get().selectRepository(repo.id);
      set({ busy: false, notice: `Repositório inicializado: ${repo.name}` });
    } catch (err) {
      set({ busy: false, error: errMsg(err) });
    }
  },

  cloneRepository: async (url) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    set({ busy: true, error: null });
    try {
      const defaultPath = usePrefsStore.getState().projectsPath || undefined;
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Escolher pasta de destino do clone",
        defaultPath,
      });
      if (!selected || Array.isArray(selected)) {
        set({ busy: false });
        return;
      }
      const name = trimmed
        .replace(/\.git$/, "")
        .split(/[/\\]/)
        .filter(Boolean)
        .pop();
      const targetDir = `${selected}/${name ?? "repo"}`;
      const operationId = newOperationId();
      set({
        operation: {
          id: operationId,
          kind: "clone",
          label: `Clonando ${name ?? trimmed}`,
          percent: null,
          lines: [],
          done: false,
          success: null,
        },
      });
      const repo = await api.cloneRepository({ url: trimmed, targetDir, operationId });
      await get().refreshRepositories();
      await get().selectRepository(repo.id);
      set({ busy: false, notice: `Clonado: ${repo.name}` });
    } catch (err) {
      set({ busy: false, error: errMsg(err) });
    }
  },

  toggleFavorite: async (id) => {
    const repo = get().repositories.find((r) => r.id === id);
    if (!repo) return;
    const updated = await api.setRepositoryFavorite(id, !repo.isFavorite);
    set({
      repositories: get().repositories.map((r) => (r.id === id ? updated : r)),
    });
  },

  removeRepository: async (id) => {
    await api.removeRepository(id);
    const repositories = get().repositories.filter((r) => r.id !== id);
    set({ repositories });
    if (get().activeRepoId === id) {
      if (repositories[0]) {
        await get().selectRepository(repositories[0].id);
      } else {
        set({ activeRepoId: null, status: null, diffText: "", selectedFile: null });
      }
    }
  },

  refreshRemotes: async () => {
    const id = get().activeRepoId;
    if (!id) {
      set({ remotes: [] });
      return;
    }
    try {
      const remotes = await api.listRemotes(id);
      set({ remotes });
    } catch (err) {
      set({ remotes: [], error: `Não foi possível ler remotes: ${errMsg(err)}` });
    }
  },

  refreshHistory: async () => {
    const id = get().activeRepoId;
    if (!id) {
      set({ graph: null, filteredCommits: null });
      return;
    }
    try {
      const limit = usePrefsStore.getState().graphCommitLimit;
      const graph = await api.getCommitGraph(id, limit);
      set({ graph, filteredCommits: null });
    } catch (err) {
      set({ error: errMsg(err) });
    }
  },

  searchCommits: async () => {
    const id = get().activeRepoId;
    const query = get().commitQuery.trim();
    if (!id) return;
    if (!query) {
      set({ filteredCommits: null });
      return;
    }
    try {
      const filteredCommits = await api.searchCommits(id, query, 100);
      set({ filteredCommits, commitSearchOpen: true });
      if (filteredCommits[0]) {
        await get().selectCommit(filteredCommits[0].hash);
      }
    } catch (err) {
      set({ error: errMsg(err) });
    }
  },

  clearCommitSearch: async () => {
    set({ commitQuery: "", filteredCommits: null, commitSearchOpen: false });
    await get().refreshHistory();
  },

  refreshBranches: async () => {
    const id = get().activeRepoId;
    if (!id) {
      set({ branches: [] });
      return;
    }
    try {
      const branches = await api.listBranches(id);
      set({ branches });
    } catch (err) {
      set({ error: errMsg(err) });
    }
  },

  refreshStash: async () => {
    const id = get().activeRepoId;
    if (!id) {
      set({ stash: [] });
      return;
    }
    try {
      const stash = await api.listStash(id);
      set({ stash });
    } catch {
      set({ stash: [] });
    }
  },

  createBranch: async (name, checkout = true) => {
    const id = get().activeRepoId;
    if (!id) return;
    set({ busy: true, error: null });
    try {
      const branches = await api.createBranch(id, name, checkout);
      set({ branches, busy: false, notice: `Branch ${name} criada.` });
      await Promise.all([get().refreshStatus(), get().refreshHistory()]);
    } catch (err) {
      set({ busy: false, error: errMsg(err) });
    }
  },

  checkoutBranch: async (name) => {
    const id = get().activeRepoId;
    if (!id) return;
    set({ busy: true, error: null });
    try {
      const branches = await api.checkoutBranch(id, name);
      const current = branches.find((b) => b.isCurrent)?.name ?? name;
      set({
        branches,
        busy: false,
        selectedBranchName: current,
        notice: `Checkout: ${current}`,
      });
      await Promise.all([
        get().refreshStatus(),
        get().refreshHistory(),
        get().refreshRepositories(),
      ]);
    } catch (err) {
      set({ busy: false, error: errMsg(err) });
    }
  },

  renameBranch: async (oldName, newName) => {
    const id = get().activeRepoId;
    if (!id) return;
    set({ busy: true, error: null });
    try {
      const branches = await api.renameBranch(id, oldName, newName);
      set({ branches, busy: false, notice: `Branch renomeada para ${newName}.` });
      await get().refreshStatus();
    } catch (err) {
      set({ busy: false, error: errMsg(err) });
    }
  },

  deleteBranch: async (name, force = false) => {
    const id = get().activeRepoId;
    if (!id) return;
    set({ busy: true, error: null });
    try {
      const branches = await api.deleteBranch(id, name, force);
      set({ branches, busy: false, notice: `Branch ${name} removida.` });
    } catch (err) {
      set({ busy: false, error: errMsg(err) });
    }
  },

  mergeBranch: async (name) => {
    const id = get().activeRepoId;
    if (!id) return;
    set({ busy: true, error: null });
    try {
      const result = await api.mergeBranch(id, name);
      set({
        busy: false,
        notice: result.message,
        error: result.success ? null : null,
      });
      await get().refreshStatus();
      await get().refreshHistory();
      await get().refreshBranches();
      if (!result.success) {
        set({
          workspaceTab: "graph",
          selectedCommitHash: null,
          error: result.message || "Merge com conflitos — resolva no painel WIP.",
        });
      }
    } catch (err) {
      set({ busy: false, error: errMsg(err) });
    }
  },

  rebaseOnto: async (upstream) => {
    const id = get().activeRepoId;
    if (!id) return;
    set({ busy: true, error: null });
    try {
      const result = await api.rebaseOnto(id, upstream);
      set({ busy: false, notice: result.message });
      await get().refreshStatus();
      await get().refreshHistory();
      await get().refreshBranches();
      if (!result.success) {
        set({
          workspaceTab: "graph",
          selectedCommitHash: null,
          error: result.message || "Merge com conflitos — resolva no painel WIP.",
        });
      }
    } catch (err) {
      set({ busy: false, error: errMsg(err) });
    }
  },

  cherryPick: async (commit) => {
    const id = get().activeRepoId;
    if (!id) return;
    set({ busy: true, error: null });
    try {
      const result = await api.cherryPickCommit(id, commit);
      set({ busy: false, notice: result.message });
      await get().refreshStatus();
      await get().refreshHistory();
      if (!result.success) {
        set({
          workspaceTab: "graph",
          selectedCommitHash: null,
          error: result.message || "Merge com conflitos — resolva no painel WIP.",
        });
      }
    } catch (err) {
      set({ busy: false, error: errMsg(err) });
    }
  },

  abortIntegrate: async () => {
    const id = get().activeRepoId;
    if (!id) return;
    set({ busy: true, error: null });
    try {
      await api.abortIntegrate(id);
      set({
        busy: false,
        notice: "Operação abortada.",
        conflictDraft: "",
        conflictPath: null,
      });
      await get().refreshStatus();
      await get().refreshHistory();
      await get().refreshBranches();
    } catch (err) {
      set({ busy: false, error: errMsg(err) });
    }
  },

  continueIntegrate: async () => {
    const id = get().activeRepoId;
    if (!id) return;
    set({ busy: true, error: null });
    try {
      const result = await api.continueIntegrate(id);
      set({
        busy: false,
        notice: result.message,
        conflictDraft: "",
        conflictPath: null,
      });
      await get().refreshStatus();
      await get().refreshHistory();
      await get().refreshBranches();
    } catch (err) {
      set({ busy: false, error: errMsg(err) });
    }
  },

  resolveConflict: async (path, strategy, content) => {
    const id = get().activeRepoId;
    if (!id) return;
    set({ busy: true, error: null });
    try {
      const state = await api.resolveConflict(id, path, strategy, content);
      set({
        busy: false,
        notice:
          state.conflicts.length === 0
            ? "Conflito resolvido. Você pode continuar a operação."
            : `Resolvido ${path}. Ainda restam ${state.conflicts.length} conflito(s).`,
        conflictPath: state.conflicts[0] ?? null,
        conflictDraft: "",
      });
      await get().refreshStatus();
      if (state.conflicts[0]) {
        await get().loadConflictFile(state.conflicts[0]);
      }
    } catch (err) {
      set({ busy: false, error: errMsg(err) });
    }
  },

  loadConflictFile: async (path) => {
    const id = get().activeRepoId;
    if (!id) return "";
    try {
      const content = await api.readConflictFile(id, path);
      set({ conflictPath: path, conflictDraft: content });
      return content;
    } catch (err) {
      set({ error: errMsg(err) });
      return "";
    }
  },

  createStash: async (message) => {
    const id = get().activeRepoId;
    if (!id) return;
    set({ busy: true, error: null });
    try {
      const stash = await api.createStash(id, message, true);
      set({ stash, busy: false, notice: "Stash criado." });
      await get().refreshStatus();
    } catch (err) {
      set({ busy: false, error: errMsg(err) });
    }
  },

  applyStash: async (selector, pop = false) => {
    const id = get().activeRepoId;
    if (!id) return;
    set({ busy: true, error: null });
    try {
      const status = await api.applyStash(id, selector, pop);
      set({ status, busy: false, notice: pop ? "Stash aplicado e removido." : "Stash aplicado." });
      await get().refreshStash();
    } catch (err) {
      set({ busy: false, error: errMsg(err) });
    }
  },

  dropStash: async (selector) => {
    const id = get().activeRepoId;
    if (!id) return;
    set({ busy: true, error: null });
    try {
      const stash = await api.dropStash(id, selector);
      set({ stash, busy: false, notice: "Stash removido." });
    } catch (err) {
      set({ busy: false, error: errMsg(err) });
    }
  },

  addRemote: async (name, url) => {
    const id = get().activeRepoId;
    if (!id) return;
    set({ busy: true, error: null });
    try {
      const remotes = await api.addRemote(id, name, url);
      set({ remotes, busy: false, notice: `Remote ${name} adicionado.` });
    } catch (err) {
      set({ busy: false, error: errMsg(err) });
    }
  },

  removeRemote: async (name) => {
    const id = get().activeRepoId;
    if (!id) return;
    set({ busy: true, error: null });
    try {
      const remotes = await api.removeRemote(id, name);
      set({ remotes, busy: false, notice: `Remote ${name} removido.` });
    } catch (err) {
      set({ busy: false, error: errMsg(err) });
    }
  },

  refreshStatus: async () => {
    const id = get().activeRepoId;
    if (!id) {
      set({ status: null });
      return;
    }
    try {
      const status = await api.getRepoStatus(id);
      set({ status });
      await get().refreshRepositories();
    } catch (err) {
      set({ error: errMsg(err) });
    }
  },

  stage: async (paths) => {
    const id = get().activeRepoId;
    if (!id || paths.length === 0) return;
    set({ busy: true, error: null });
    try {
      const status = await api.stagePaths(id, paths);
      set({ status, busy: false });
    } catch (err) {
      set({ busy: false, error: errMsg(err) });
    }
  },

  unstage: async (paths) => {
    const id = get().activeRepoId;
    if (!id || paths.length === 0) return;
    set({ busy: true, error: null });
    try {
      const status = await api.unstagePaths(id, paths);
      set({ status, busy: false });
    } catch (err) {
      set({ busy: false, error: errMsg(err) });
    }
  },

  selectFile: async (file) => {
    if (!file) {
      set({ selectedFile: null, diffText: "", workspaceTab: "graph" });
      return;
    }
    const id = get().activeRepoId;
    if (!id) return;
    set({
      selectedFile: { path: file.path, staged: file.staged },
      selectedCommitFile: null,
      commitFileContent: "",
      workspaceTab: "changes",
      busy: true,
      error: null,
    });
    try {
      const diffText = await api.getFileDiff(id, file.path, file.staged);
      set({ diffText, busy: false });
    } catch (err) {
      set({
        diffText: "",
        busy: false,
        error: errMsg(err),
      });
    }
  },

  setCommitMessage: (message) => set({ commitMessage: message }),
  setCommitOverrideProfileId: (id) => set({ commitOverrideProfileId: id }),
  setWorkspaceTab: (tab) => set({ workspaceTab: tab }),

  openStartTab: () => {
    const tabs = [...get().shellTabs];
    if (!tabs.some((t) => t.id === START_TAB.id)) tabs.unshift({ ...START_TAB });
    set({
      shellTabs: tabs,
      activeShellTabId: START_TAB.id,
      appView: "dashboard",
    });
  },

  openSettingsTab: () => {
    const id = tabIdFor("settings");
    const tabs = [...get().shellTabs];
    if (!tabs.some((t) => t.id === id)) {
      tabs.push({ id, kind: "settings", title: "Preferences" });
    }
    set({ shellTabs: tabs, activeShellTabId: id, appView: "settings" });
  },

  openCredentialsTab: () => {
    const id = tabIdFor("credentials");
    const tabs = [...get().shellTabs];
    if (!tabs.some((t) => t.id === id)) {
      tabs.push({ id, kind: "credentials", title: "Credentials" });
    }
    set({ shellTabs: tabs, activeShellTabId: id, appView: "credentials" });
  },

  openAboutTab: () => {
    const id = tabIdFor("about");
    const tabs = [...get().shellTabs];
    if (!tabs.some((t) => t.id === id)) {
      tabs.push({ id, kind: "about", title: "About" });
    }
    set({ shellTabs: tabs, activeShellTabId: id, appView: "about" });
  },

  openSshTab: () => {
    const id = tabIdFor("ssh");
    const tabs = [...get().shellTabs];
    if (!tabs.some((t) => t.id === id)) {
      tabs.push({ id, kind: "ssh", title: "SSH Keys" });
    }
    set({ shellTabs: tabs, activeShellTabId: id, appView: "ssh" });
  },

  openPluginsTab: () => {
    const id = tabIdFor("plugins");
    const tabs = [...get().shellTabs];
    if (!tabs.some((t) => t.id === id)) {
      tabs.push({ id, kind: "plugins", title: "Plugins" });
    }
    set({ shellTabs: tabs, activeShellTabId: id, appView: "plugins" });
  },

  activateShellTab: async (id) => {
    const tab = get().shellTabs.find((t) => t.id === id);
    if (!tab) return;
    set({ activeShellTabId: id, appView: appViewForTab(tab) });
    if (tab.kind === "repo" && tab.repoId) {
      if (tab.repoId !== get().activeRepoId) {
        await get().selectRepository(tab.repoId);
      } else {
        set({ appView: "history", activeShellTabId: id });
      }
    }
  },

  closeShellTab: (id) => {
    const tabs = get().shellTabs;
    const idx = tabs.findIndex((t) => t.id === id);
    if (idx < 0) return;
    // Always keep at least Start
    let next = tabs.filter((t) => t.id !== id);
    if (next.length === 0) next = [{ ...START_TAB }];
    if (!next.some((t) => t.kind === "start") && !next.some((t) => t.kind === "repo")) {
      next = [{ ...START_TAB }, ...next];
    }
    const wasActive = get().activeShellTabId === id;
    set({ shellTabs: next });
    if (wasActive) {
      const focus = next[Math.min(idx, next.length - 1)] ?? next[0];
      void get().activateShellTab(focus.id);
    }
  },

  setAppView: (view) => {
    if (view === "dashboard") {
      get().openStartTab();
      return;
    }
    if (view === "settings") {
      get().openSettingsTab();
      return;
    }
    if (view === "credentials") {
      get().openCredentialsTab();
      return;
    }
    if (view === "about") {
      get().openAboutTab();
      return;
    }
    if (view === "ssh") {
      get().openSshTab();
      return;
    }
    if (view === "plugins") {
      get().openPluginsTab();
      return;
    }
    if (view === "history") {
      if (get().activeRepoId) {
        void get().selectRepository(get().activeRepoId!);
        return;
      }
      const first = get().repositories[0];
      if (first) {
        void get().selectRepository(first.id);
        return;
      }
      get().openStartTab();
      set({ notice: "Abra um repositório para ver o histórico." });
      return;
    }
    // repositories / favorites / ssh / plugins — open Start and set view
    const tabs = [...get().shellTabs];
    if (!tabs.some((t) => t.id === START_TAB.id)) tabs.unshift({ ...START_TAB });
    set({ shellTabs: tabs, activeShellTabId: START_TAB.id, appView: view });
  },

  selectCommit: async (hash) => {
    const id = get().activeRepoId;
    if (!hash || !id) {
      set({
        selectedCommitHash: null,
        commitFiles: [],
        selectedCommitFile: null,
        commitFileContent: "",
        diffText: "",
      });
      return;
    }
    set({
      selectedCommitHash: hash,
      selectedCommitFile: null,
      commitFileContent: "",
      selectedFile: null,
      diffText: "",
      commitFileViewMode: "diff",
    });
    try {
      const commitFiles = await api.getCommitFiles(id, hash);
      set({ commitFiles });
    } catch (err) {
      set({ commitFiles: [], error: errMsg(err) });
    }
  },

  setCommitFileViewMode: (mode) => set({ commitFileViewMode: mode }),

  selectCommitFile: async (path) => {
    if (!path) {
      set({
        selectedCommitFile: null,
        commitFileContent: "",
        diffText: "",
        commitFileViewMode: "diff",
      });
      return;
    }
    const id = get().activeRepoId;
    const hash = get().selectedCommitHash;
    if (!id || !hash) return;
    set({
      selectedCommitFile: path,
      selectedFile: null,
      busy: true,
      error: null,
      commitFileViewMode: "diff",
    });
    try {
      const [diffText, content] = await Promise.all([
        api.getCommitFileDiff(id, hash, path),
        api.getFileAtCommit(id, hash, path).catch(() => ""),
      ]);
      set({ diffText, commitFileContent: content, busy: false });
    } catch (err) {
      set({
        diffText: "",
        commitFileContent: "",
        busy: false,
        error: errMsg(err),
      });
    }
  },

  navigateCommitFile: async (dir) => {
    const files = get().commitFiles;
    const current = get().selectedCommitFile;
    if (files.length === 0) return;
    const idx = current ? files.findIndex((f) => f.path === current) : -1;
    const next = Math.min(files.length - 1, Math.max(0, (idx < 0 ? 0 : idx) + dir));
    const target = files[next];
    if (target && target.path !== current) {
      await get().selectCommitFile(target.path);
    }
  },

  openCommitFileInWorkingDir: async () => {
    const path = get().selectedCommitFile;
    const repoId = get().activeRepoId;
    const repo = get().repositories.find((r) => r.id === repoId);
    if (!path || !repo) return;
    try {
      const { openPath } = await import("@tauri-apps/plugin-opener");
      const sep = repo.path.includes("\\") ? "\\" : "/";
      const full = `${repo.path.replace(/[\\/]$/, "")}${sep}${path.replace(/\//g, sep)}`;
      await openPath(full);
    } catch (err) {
      set({ error: errMsg(err) });
    }
  },

  createProfile: async (input, opts) => {
    set({ busy: true, error: null });
    try {
      await api.createProfile(input);
      await get().refreshProfiles();
      set({ busy: false, notice: "Perfil criado." });
      if (!opts?.stay) get().openCredentialsTab();
    } catch (err) {
      set({ busy: false, error: errMsg(err) });
      throw err;
    }
  },

  deleteProfile: async (id) => {
    set({ busy: true, error: null });
    try {
      await api.deleteProfile(id);
      await get().refreshProfiles();
      await get().refreshRepositories();
      set({ busy: false, notice: "Perfil removido." });
    } catch (err) {
      set({ busy: false, error: errMsg(err) });
    }
  },

  associateProfile: async (profileId) => {
    const repoId = get().activeRepoId;
    if (!repoId) return;
    set({ busy: true, error: null });
    try {
      const updated = await api.setRepositoryProfile(repoId, profileId);
      set({
        repositories: get().repositories.map((r) => (r.id === repoId ? updated : r)),
        commitOverrideProfileId: profileId,
        busy: false,
        notice: profileId ? "Identidade associada ao repositório." : "Associação removida.",
      });
    } catch (err) {
      set({ busy: false, error: errMsg(err) });
    }
  },

  commit: async () => {
    const repoId = get().activeRepoId;
    const message = get().commitMessage;
    if (!repoId) return;
    set({ busy: true, error: null });
    try {
      const result = await api.commitChanges({
        repositoryId: repoId,
        message,
        profileId: get().commitOverrideProfileId,
      });
      set({
        busy: false,
        commitMessage: "",
        lastCommit: result,
        notice: `Commit ${result.hash} como ${result.authorName}`,
      });
      await get().refreshStatus();
      set({ selectedFile: null, diffText: "" });
    } catch (err) {
      set({ busy: false, error: errMsg(err) });
    }
  },

  fetch: async () => {
    const id = get().activeRepoId;
    if (!id) return;
    await get().refreshRemotes();
    if (get().remotes.length === 0) {
      set({
        error:
          "Sem remote. No painel direito (WIP), use o campo “URL do origin” e clique Add — depois tente de novo.",
        workspaceTab: "graph",
        selectedCommitHash: null,
      });
      return;
    }
    const remote = get().remotes.find((r) => r.name === "origin")?.name ?? get().remotes[0]?.name;
    const operationId = newOperationId();
    set({
      operation: {
        id: operationId,
        kind: "fetch",
        label: `Fetch (${remote})`,
        percent: null,
        lines: [],
        done: false,
        success: null,
      },
      error: null,
    });
    try {
      const status = await api.fetchRemote({ repositoryId: id, operationId, remote });
      set({ status, notice: "Fetch concluído." });
      await Promise.all([get().refreshRepositories(), get().refreshBranches()]);
    } catch (err) {
      set({ error: errMsg(err) });
    }
  },

  pull: async () => {
    const id = get().activeRepoId;
    if (!id) return;
    await get().refreshRemotes();
    if (get().remotes.length === 0) {
      set({
        error:
          "Sem remote. No painel direito (WIP), use o campo “URL do origin” e clique Add — depois tente de novo.",
        workspaceTab: "graph",
        selectedCommitHash: null,
      });
      return;
    }
    const remote = get().remotes.find((r) => r.name === "origin")?.name ?? get().remotes[0]?.name;
    const branch = get().status?.branch ?? null;
    const operationId = newOperationId();
    set({
      operation: {
        id: operationId,
        kind: "pull",
        label: `Pull (${remote}${branch ? `/${branch}` : ""})`,
        percent: null,
        lines: [],
        done: false,
        success: null,
      },
      error: null,
    });
    try {
      const status = await api.pullRemote({
        repositoryId: id,
        operationId,
        remote,
        branch,
      });
      set({ status, notice: "Pull concluído." });
      await Promise.all([
        get().refreshStatus(),
        get().refreshHistory(),
        get().refreshBranches(),
      ]);
    } catch (err) {
      set({ error: errMsg(err) });
    }
  },

  push: async () => {
    const id = get().activeRepoId;
    if (!id) return;
    await get().refreshRemotes();
    if (get().remotes.length === 0) {
      set({
        error:
          "Sem remote. No painel direito (WIP), use o campo “URL do origin” e clique Add — depois tente de novo.",
        workspaceTab: "graph",
        selectedCommitHash: null,
      });
      return;
    }
    const repo = get().repositories.find((r) => r.id === id);
    const branch = get().status?.branch ?? repo?.branch ?? null;
    const remote = get().remotes.find((r) => r.name === "origin")?.name ?? get().remotes[0]?.name;
    const operationId = newOperationId();
    set({
      operation: {
        id: operationId,
        kind: "push",
        label: `Push (${remote}${branch ? `/${branch}` : ""})`,
        percent: null,
        lines: [],
        done: false,
        success: null,
      },
      error: null,
    });
    try {
      await api.pushRemote({
        repositoryId: id,
        operationId,
        remote,
        branch,
        setUpstream: true,
      });
      set({ notice: "Push concluído." });
      await Promise.all([
        get().refreshRepositories(),
        get().refreshBranches(),
        get().refreshStatus(),
      ]);
    } catch (err) {
      set({ error: errMsg(err) });
    }
  },

  cancelOperation: async () => {
    const op = get().operation;
    if (!op || op.done) return;
    try {
      await api.cancelOperation(op.id);
      set({ notice: "Operação cancelada." });
    } catch (err) {
      set({ error: errMsg(err) });
    }
  },
}));
