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

export type AppHealth = z.infer<typeof appHealthSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type Repository = z.infer<typeof repositorySchema>;
export type FileChange = z.infer<typeof fileChangeSchema>;
export type RepoStatus = z.infer<typeof repoStatusSchema>;
export type CommitResult = z.infer<typeof commitResultSchema>;
export type RemoteInfo = z.infer<typeof remoteInfoSchema>;
export type ProgressEvent = z.infer<typeof progressEventSchema>;

export type CreateProfileInput = {
  name: string;
  email: string;
  sshKeyPath?: string | null;
  provider?: string | null;
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

export async function updateProfile(
  input: CreateProfileInput & { id: string },
): Promise<Profile> {
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

export async function setRepositoryFavorite(
  id: string,
  isFavorite: boolean,
): Promise<Repository> {
  return repositorySchema.parse(
    await invoke("set_repository_favorite", { id, isFavorite }),
  );
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

export async function stagePaths(
  repositoryId: string,
  paths: string[],
): Promise<RepoStatus> {
  return repoStatusSchema.parse(await invoke("stage_paths", { repositoryId, paths }));
}

export async function unstagePaths(
  repositoryId: string,
  paths: string[],
): Promise<RepoStatus> {
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
  return z
    .array(remoteInfoSchema)
    .parse(await invoke("add_remote", { repositoryId, name, url }));
}

export async function removeRemote(
  repositoryId: string,
  name: string,
): Promise<RemoteInfo[]> {
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
