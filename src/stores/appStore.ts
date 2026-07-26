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

type WorkspaceTab = "graph" | "commits" | "changes" | "branches" | "stash" | "files";
type RightTab = "changes" | "credentials";

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
  rightTab: RightTab;
  busy: boolean;
  notice: string | null;
  error: string | null;

  remotes: RemoteInfo[];
  operation: ActiveOperation | null;

  graph: CommitGraph | null;
  commitQuery: string;
  filteredCommits: CommitSummary[] | null;
  branches: BranchInfo[];
  stash: StashEntry[];
  branchFilter: string;

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
  searchCommits: () => Promise<void>;
  setBranchFilter: (query: string) => void;
  createBranch: (name: string, checkout?: boolean) => Promise<void>;
  checkoutBranch: (name: string) => Promise<void>;
  renameBranch: (oldName: string, newName: string) => Promise<void>;
  deleteBranch: (name: string, force?: boolean) => Promise<void>;
  createStash: (message?: string) => Promise<void>;
  applyStash: (selector: string, pop?: boolean) => Promise<void>;
  dropStash: (selector: string) => Promise<void>;
  addRemote: (name: string, url: string) => Promise<void>;
  removeRemote: (name: string) => Promise<void>;
  stage: (paths: string[]) => Promise<void>;
  unstage: (paths: string[]) => Promise<void>;
  selectFile: (file: FileChange) => Promise<void>;
  setCommitMessage: (message: string) => void;
  setCommitOverrideProfileId: (id: string | null) => void;
  setWorkspaceTab: (tab: WorkspaceTab) => void;
  setRightTab: (tab: RightTab) => void;
  createProfile: (input: CreateProfileInput) => Promise<void>;
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
  workspaceTab: "changes",
  rightTab: "changes",
  busy: false,
  notice: null,
  error: null,
  remotes: [],
  operation: null,
  graph: null,
  commitQuery: "",
  filteredCommits: null,
  branches: [],
  stash: [],
  branchFilter: "",

  clearNotice: () => set({ notice: null, error: null }),
  dismissOperation: () => set({ operation: null }),
  setCommitQuery: (query) => set({ commitQuery: query }),
  setBranchFilter: (query) => set({ branchFilter: query }),

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
      const repos = get().repositories;
      if (repos[0]) {
        await get().selectRepository(repos[0].id);
      }
      set({ bootLoading: false });
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
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Abrir repositório Git",
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
    set({
      activeRepoId: id,
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
    });
    const repo = get().repositories.find((r) => r.id === id);
    set({
      commitOverrideProfileId: repo?.defaultProfileId ?? null,
    });
    await Promise.all([
      get().refreshStatus(),
      get().refreshRemotes(),
      get().refreshHistory(),
      get().refreshBranches(),
      get().refreshStash(),
    ]);
  },

  initRepositoryDialog: async () => {
    set({ busy: true, error: null });
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Escolher pasta para inicializar repositório",
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
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Escolher pasta de destino do clone",
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
    } catch {
      set({ remotes: [] });
    }
  },

  refreshHistory: async () => {
    const id = get().activeRepoId;
    if (!id) {
      set({ graph: null, filteredCommits: null });
      return;
    }
    try {
      const graph = await api.getCommitGraph(id, 150);
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
      set({ filteredCommits });
    } catch (err) {
      set({ error: errMsg(err) });
    }
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
      set({ branches, busy: false, notice: `Checkout: ${name}` });
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
    const id = get().activeRepoId;
    if (!id) return;
    set({
      selectedFile: { path: file.path, staged: file.staged },
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
  setRightTab: (tab) => set({ rightTab: tab }),

  createProfile: async (input) => {
    set({ busy: true, error: null });
    try {
      await api.createProfile(input);
      await get().refreshProfiles();
      set({ busy: false, notice: "Perfil criado.", rightTab: "credentials" });
    } catch (err) {
      set({ busy: false, error: errMsg(err) });
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
    const operationId = newOperationId();
    set({
      operation: {
        id: operationId,
        kind: "fetch",
        label: "Fetch",
        percent: null,
        lines: [],
        done: false,
        success: null,
      },
      error: null,
    });
    try {
      const status = await api.fetchRemote({ repositoryId: id, operationId });
      set({ status, notice: "Fetch concluído." });
      await get().refreshRepositories();
    } catch (err) {
      set({ error: errMsg(err) });
    }
  },

  pull: async () => {
    const id = get().activeRepoId;
    if (!id) return;
    const operationId = newOperationId();
    set({
      operation: {
        id: operationId,
        kind: "pull",
        label: "Pull",
        percent: null,
        lines: [],
        done: false,
        success: null,
      },
      error: null,
    });
    try {
      const status = await api.pullRemote({ repositoryId: id, operationId });
      set({ status, notice: "Pull concluído." });
      await get().refreshStatus();
    } catch (err) {
      set({ error: errMsg(err) });
    }
  },

  push: async () => {
    const id = get().activeRepoId;
    if (!id) return;
    const repo = get().repositories.find((r) => r.id === id);
    const branch = get().status?.branch ?? repo?.branch ?? null;
    const operationId = newOperationId();
    set({
      operation: {
        id: operationId,
        kind: "push",
        label: "Push",
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
        remote: "origin",
        branch,
        setUpstream: true,
      });
      set({ notice: "Push concluído." });
      await get().refreshRepositories();
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
