import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";

const gitPrerequisiteSchema = z.object({
  available: z.boolean(),
  version: z.string().nullable().optional(),
  path: z.string().nullable().optional(),
  message: z.string(),
});

export const appHealthSchema = z.object({
  appVersion: z.string(),
  git: gitPrerequisiteSchema,
  databaseReady: z.boolean(),
});

export const profileSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  sshKeyPath: z.string().nullable().optional(),
  provider: z.string().nullable().optional(),
  avatarData: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const repositorySchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  defaultProfileId: z.string().nullable().optional(),
  isFavorite: z.boolean(),
  lastOpenedAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  branch: z.string().nullable().optional(),
  activeProfile: profileSchema.nullable().optional(),
});

export const fileChangeSchema = z.object({
  path: z.string(),
  status: z.string(),
  staged: z.boolean(),
});

export const repoStatusSchema = z.object({
  branch: z.string().nullable().optional(),
  staged: z.array(fileChangeSchema),
  unstaged: z.array(fileChangeSchema),
  upstream: z.string().nullable().optional(),
  ahead: z.number().optional().default(0),
  behind: z.number().optional().default(0),
  inProgress: z.string().nullable().optional(),
  conflicts: z.array(z.string()).optional().default([]),
});

export const integrateStateSchema = z.object({
  kind: z.string().nullable().optional(),
  conflicts: z.array(z.string()),
});

export const conflictFileSidesSchema = z.object({
  path: z.string(),
  ours: z.string(),
  theirs: z.string(),
  merged: z.string(),
});

export const integrateResultSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  state: integrateStateSchema,
});

export const commitResultSchema = z.object({
  hash: z.string(),
  message: z.string(),
  authorName: z.string(),
  authorEmail: z.string(),
});

export const remoteInfoSchema = z.object({
  name: z.string(),
  fetchUrl: z.string().nullable().optional(),
  pushUrl: z.string().nullable().optional(),
});

export const progressEventSchema = z.object({
  operationId: z.string(),
  stream: z.string(),
  message: z.string(),
  percent: z.number().nullable().optional(),
  done: z.boolean(),
  success: z.boolean().nullable().optional(),
});

export const commitSummarySchema = z.object({
  hash: z.string(),
  shortHash: z.string(),
  parents: z.array(z.string()),
  subject: z.string(),
  authorName: z.string(),
  authorEmail: z.string(),
  authoredAt: z.string(),
  refs: z.array(z.string()),
  lane: z.number(),
});

export const graphEdgeSchema = z.object({
  fromHash: z.string(),
  toHash: z.string(),
  fromLane: z.number(),
  toLane: z.number(),
});

export const commitGraphSchema = z.object({
  commits: z.array(commitSummarySchema),
  edges: z.array(graphEdgeSchema),
});

export const branchInfoSchema = z.object({
  name: z.string(),
  isRemote: z.boolean(),
  isCurrent: z.boolean(),
  isHead: z.boolean(),
  upstream: z.string().nullable().optional(),
  ahead: z.number().nullable().optional(),
  behind: z.number().nullable().optional(),
  tipHash: z.string().nullable().optional(),
});

export const tagInfoSchema = z.object({
  name: z.string(),
  tipHash: z.string().nullable().optional(),
});

export const stashEntrySchema = z.object({
  index: z.number(),
  selector: z.string(),
  message: z.string(),
  authoredAt: z.string().nullable().optional(),
});

export const upstreamStatusSchema = z.object({
  branch: z.string().nullable().optional(),
  upstream: z.string().nullable().optional(),
  ahead: z.number(),
  behind: z.number(),
});

export type AppHealth = z.infer<typeof appHealthSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type Repository = z.infer<typeof repositorySchema>;
export type FileChange = z.infer<typeof fileChangeSchema>;
export type RepoStatus = z.infer<typeof repoStatusSchema>;
export type CommitResult = z.infer<typeof commitResultSchema>;
export type RemoteInfo = z.infer<typeof remoteInfoSchema>;
export type ProgressEvent = z.infer<typeof progressEventSchema>;
export type CommitSummary = z.infer<typeof commitSummarySchema>;
export type CommitGraph = z.infer<typeof commitGraphSchema>;
export type BranchInfo = z.infer<typeof branchInfoSchema>;
export type TagInfo = z.infer<typeof tagInfoSchema>;
export type StashEntry = z.infer<typeof stashEntrySchema>;
export type UpstreamStatus = z.infer<typeof upstreamStatusSchema>;

export type CreateProfileInput = {
  name: string;
  email: string;
  sshKeyPath?: string | null;
  provider?: string | null;
  avatarData?: string | null;
};

export async function getAppHealth(): Promise<AppHealth> {
  return appHealthSchema.parse(await invoke("get_app_health"));
}

export async function listProfiles(): Promise<Profile[]> {
  return z.array(profileSchema).parse(await invoke("list_profiles"));
}

export async function createProfile(input: CreateProfileInput): Promise<Profile> {
  return profileSchema.parse(await invoke("create_profile", { input }));
}

export async function updateProfile(input: CreateProfileInput & { id: string }): Promise<Profile> {
  return profileSchema.parse(await invoke("update_profile", { input }));
}

export async function deleteProfile(id: string): Promise<void> {
  await invoke("delete_profile", { id });
}

export async function listRepositories(): Promise<Repository[]> {
  return z.array(repositorySchema).parse(await invoke("list_repositories"));
}

export async function openRepository(path: string): Promise<Repository> {
  return repositorySchema.parse(await invoke("open_repository", { path }));
}

export async function setRepositoryFavorite(id: string, isFavorite: boolean): Promise<Repository> {
  return repositorySchema.parse(await invoke("set_repository_favorite", { id, isFavorite }));
}

export async function setRepositoryProfile(
  repositoryId: string,
  profileId: string | null,
): Promise<Repository> {
  return repositorySchema.parse(
    await invoke("set_repository_profile", { repositoryId, profileId }),
  );
}

export async function removeRepository(id: string): Promise<void> {
  await invoke("remove_repository", { id });
}

export async function getRepoStatus(repositoryId: string): Promise<RepoStatus> {
  return repoStatusSchema.parse(await invoke("get_repo_status", { repositoryId }));
}

export async function stagePaths(repositoryId: string, paths: string[]): Promise<RepoStatus> {
  return repoStatusSchema.parse(await invoke("stage_paths", { repositoryId, paths }));
}

export async function unstagePaths(repositoryId: string, paths: string[]): Promise<RepoStatus> {
  return repoStatusSchema.parse(await invoke("unstage_paths", { repositoryId, paths }));
}

export async function getFileDiff(
  repositoryId: string,
  path: string,
  staged: boolean,
): Promise<string> {
  return z.string().parse(await invoke("get_file_diff", { repositoryId, path, staged }));
}

export async function commitChanges(input: {
  repositoryId: string;
  message: string;
  profileId?: string | null;
  authorName?: string | null;
  authorEmail?: string | null;
}): Promise<CommitResult> {
  return commitResultSchema.parse(await invoke("commit_changes", { input }));
}

export async function initRepository(path: string, bare = false): Promise<Repository> {
  return repositorySchema.parse(await invoke("init_repository", { path, bare }));
}

export async function listRemotes(repositoryId: string): Promise<RemoteInfo[]> {
  return z.array(remoteInfoSchema).parse(await invoke("list_remotes", { repositoryId }));
}

export async function addRemote(
  repositoryId: string,
  name: string,
  url: string,
): Promise<RemoteInfo[]> {
  return z.array(remoteInfoSchema).parse(await invoke("add_remote", { repositoryId, name, url }));
}

export async function removeRemote(repositoryId: string, name: string): Promise<RemoteInfo[]> {
  return z.array(remoteInfoSchema).parse(await invoke("remove_remote", { repositoryId, name }));
}

export async function cancelOperation(operationId: string): Promise<void> {
  await invoke("cancel_operation", { operationId });
}

export async function cloneRepository(input: {
  url: string;
  targetDir: string;
  operationId: string;
}): Promise<Repository> {
  return repositorySchema.parse(await invoke("clone_repository", { input }));
}

export type SyncInput = {
  repositoryId: string;
  operationId: string;
  remote?: string | null;
  branch?: string | null;
  setUpstream?: boolean;
  rebase?: boolean;
  profileId?: string | null;
};

export async function fetchRemote(input: SyncInput): Promise<RepoStatus> {
  return repoStatusSchema.parse(await invoke("fetch_remote", { input }));
}

export async function pullRemote(input: SyncInput): Promise<RepoStatus> {
  return repoStatusSchema.parse(await invoke("pull_remote", { input }));
}

export async function pushRemote(input: SyncInput): Promise<string> {
  return z.string().parse(await invoke("push_remote", { input }));
}

export type SshAskpassRequest = {
  requestId: string;
  prompt: string;
};

export async function respondSshAskpass(input: {
  requestId: string;
  passphrase?: string | null;
  cancelled?: boolean;
}): Promise<void> {
  await invoke("respond_ssh_askpass", {
    requestId: input.requestId,
    passphrase: input.cancelled ? null : (input.passphrase ?? null),
    cancelled: input.cancelled ?? false,
  });
}

export async function getCommitGraph(repositoryId: string, limit = 120): Promise<CommitGraph> {
  return commitGraphSchema.parse(await invoke("get_commit_graph", { repositoryId, limit }));
}

export async function searchCommits(
  repositoryId: string,
  query: string,
  limit = 80,
): Promise<CommitSummary[]> {
  return z
    .array(commitSummarySchema)
    .parse(await invoke("search_commits", { repositoryId, query, limit }));
}

export const commitFileChangeSchema = z.object({
  path: z.string(),
  status: z.string(),
});

export type CommitFileChange = z.infer<typeof commitFileChangeSchema>;

export async function getCommitFiles(
  repositoryId: string,
  hash: string,
): Promise<CommitFileChange[]> {
  return z
    .array(commitFileChangeSchema)
    .parse(await invoke("get_commit_files", { repositoryId, hash }));
}

export async function getCommitFileDiff(
  repositoryId: string,
  hash: string,
  path: string,
): Promise<string> {
  return z.string().parse(await invoke("get_commit_file_diff", { repositoryId, hash, path }));
}

export async function getFileAtCommit(
  repositoryId: string,
  hash: string,
  path: string,
): Promise<string> {
  return z.string().parse(await invoke("get_file_at_commit", { repositoryId, hash, path }));
}

export async function listBranches(repositoryId: string): Promise<BranchInfo[]> {
  return z.array(branchInfoSchema).parse(await invoke("list_branches", { repositoryId }));
}

export async function listTags(repositoryId: string): Promise<TagInfo[]> {
  return z.array(tagInfoSchema).parse(await invoke("list_tags", { repositoryId }));
}

export async function createBranch(
  repositoryId: string,
  name: string,
  checkout = true,
  startPoint?: string | null,
): Promise<BranchInfo[]> {
  return z.array(branchInfoSchema).parse(
    await invoke("create_branch", {
      repositoryId,
      name,
      checkout,
      startPoint: startPoint ?? null,
    }),
  );
}

export async function resetToCommit(
  repositoryId: string,
  commit: string,
  mode: "soft" | "mixed" | "hard",
): Promise<RepoStatus> {
  return repoStatusSchema.parse(await invoke("reset_to_commit", { repositoryId, commit, mode }));
}

export async function revertCommit(repositoryId: string, commit: string): Promise<RepoStatus> {
  return repoStatusSchema.parse(await invoke("revert_commit", { repositoryId, commit }));
}

export async function checkoutBranch(
  repositoryId: string,
  name: string,
  force = false,
): Promise<BranchInfo[]> {
  return z
    .array(branchInfoSchema)
    .parse(await invoke("checkout_branch", { repositoryId, name, force }));
}

export async function renameBranch(
  repositoryId: string,
  oldName: string,
  newName: string,
): Promise<BranchInfo[]> {
  return z
    .array(branchInfoSchema)
    .parse(await invoke("rename_branch", { repositoryId, oldName, newName }));
}

export async function deleteBranch(
  repositoryId: string,
  name: string,
  force = false,
): Promise<BranchInfo[]> {
  return z
    .array(branchInfoSchema)
    .parse(await invoke("delete_branch", { repositoryId, name, force }));
}

export async function getUpstreamStatus(repositoryId: string): Promise<UpstreamStatus> {
  return upstreamStatusSchema.parse(await invoke("get_upstream_status", { repositoryId }));
}

export async function listStash(repositoryId: string): Promise<StashEntry[]> {
  return z.array(stashEntrySchema).parse(await invoke("list_stash", { repositoryId }));
}

export async function createStash(
  repositoryId: string,
  message?: string,
  includeUntracked = true,
): Promise<StashEntry[]> {
  return z.array(stashEntrySchema).parse(
    await invoke("create_stash", {
      repositoryId,
      message: message ?? null,
      includeUntracked,
    }),
  );
}

export async function applyStash(
  repositoryId: string,
  selector: string,
  pop = false,
): Promise<RepoStatus> {
  return repoStatusSchema.parse(await invoke("apply_stash", { repositoryId, selector, pop }));
}

export async function dropStash(repositoryId: string, selector: string): Promise<StashEntry[]> {
  return z.array(stashEntrySchema).parse(await invoke("drop_stash", { repositoryId, selector }));
}

export type IntegrateState = z.infer<typeof integrateStateSchema>;
export type IntegrateResult = z.infer<typeof integrateResultSchema>;

export async function mergeBranch(repositoryId: string, branch: string): Promise<IntegrateResult> {
  return integrateResultSchema.parse(await invoke("merge_branch", { repositoryId, branch }));
}

export async function cherryPickCommit(
  repositoryId: string,
  commit: string,
): Promise<IntegrateResult> {
  return integrateResultSchema.parse(await invoke("cherry_pick_commit", { repositoryId, commit }));
}

export async function rebaseOnto(repositoryId: string, upstream: string): Promise<IntegrateResult> {
  return integrateResultSchema.parse(await invoke("rebase_onto", { repositoryId, upstream }));
}

export async function abortIntegrate(repositoryId: string): Promise<IntegrateState> {
  return integrateStateSchema.parse(await invoke("abort_integrate", { repositoryId }));
}

export async function continueIntegrate(repositoryId: string): Promise<IntegrateResult> {
  return integrateResultSchema.parse(await invoke("continue_integrate", { repositoryId }));
}

export async function resolveConflict(
  repositoryId: string,
  path: string,
  strategy: "ours" | "theirs" | "content",
  content?: string,
): Promise<IntegrateState> {
  return integrateStateSchema.parse(
    await invoke("resolve_conflict", {
      repositoryId,
      path,
      strategy,
      content: content ?? null,
    }),
  );
}

export async function readConflictFile(repositoryId: string, path: string): Promise<string> {
  return z.string().parse(await invoke("read_conflict_file", { repositoryId, path }));
}

export type ConflictFileSides = z.infer<typeof conflictFileSidesSchema>;

export async function readConflictSides(
  repositoryId: string,
  path: string,
): Promise<ConflictFileSides> {
  return conflictFileSidesSchema.parse(await invoke("read_conflict_sides", { repositoryId, path }));
}

export async function listRepoFiles(repositoryId: string): Promise<string[]> {
  return z.array(z.string()).parse(await invoke("list_repo_files", { repositoryId }));
}

export async function terminalCreate(
  repositoryId: string | null,
  cols: number,
  rows: number,
): Promise<string> {
  return z.string().parse(
    await invoke("terminal_create", {
      repositoryId,
      cols,
      rows,
    }),
  );
}

export async function terminalWrite(sessionId: string, data: string): Promise<void> {
  await invoke("terminal_write", { sessionId, data });
}

export async function terminalResize(sessionId: string, cols: number, rows: number): Promise<void> {
  await invoke("terminal_resize", { sessionId, cols, rows });
}

export async function terminalKill(sessionId: string): Promise<void> {
  await invoke("terminal_kill", { sessionId });
}

export async function terminalSetEnabled(enabled: boolean): Promise<void> {
  await invoke("terminal_set_enabled", { enabled });
}

export async function terminalKillAll(): Promise<void> {
  await invoke("terminal_kill_all");
}
