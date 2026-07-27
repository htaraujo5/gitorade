use tauri::{AppHandle, State};

use crate::domain::{
    AppHealth, BranchInfo, CloneInput, CommitFileChange, CommitGraph, CommitInput, CommitResult,
    CommitSummary, CreateProfileInput, IntegrateResult, IntegrateState, Profile, RemoteInfo,
    RepoStatus, Repository, StashEntry, SyncInput, TagInfo, UpdateProfileInput, UpstreamStatus,
};
use crate::error::{AppError, AppResult};
use crate::git;
use crate::ops::OperationRegistry;
use crate::storage::Database;
use crate::terminal::TerminalRegistry;

#[tauri::command]
pub fn get_app_health(db: State<'_, Database>) -> AppResult<AppHealth> {
    let git = git::detect_git();
    let database_ready = db.ping().is_ok();

    Ok(AppHealth {
        app_version: env!("CARGO_PKG_VERSION").into(),
        git,
        database_ready,
    })
}

#[tauri::command]
pub fn list_profiles(db: State<'_, Database>) -> AppResult<Vec<Profile>> {
    db.list_profiles()
}

#[tauri::command]
pub fn create_profile(db: State<'_, Database>, input: CreateProfileInput) -> AppResult<Profile> {
    validate_profile_ssh_key(input.ssh_key_path.as_deref())?;
    db.create_profile(input)
}

#[tauri::command]
pub fn update_profile(db: State<'_, Database>, input: UpdateProfileInput) -> AppResult<Profile> {
    validate_profile_ssh_key(input.ssh_key_path.as_deref())?;
    db.update_profile(input)
}

#[tauri::command]
pub fn delete_profile(db: State<'_, Database>, id: String) -> AppResult<()> {
    db.delete_profile(&id)
}

#[tauri::command]
pub fn list_repositories(db: State<'_, Database>) -> AppResult<Vec<Repository>> {
    db.list_repositories()
}

#[tauri::command]
pub fn open_repository(db: State<'_, Database>, path: String) -> AppResult<Repository> {
    db.open_repository_path(&path)
}

#[tauri::command]
pub fn set_repository_favorite(
    db: State<'_, Database>,
    id: String,
    is_favorite: bool,
) -> AppResult<Repository> {
    db.set_repository_favorite(&id, is_favorite)
}

#[tauri::command]
pub fn set_repository_profile(
    db: State<'_, Database>,
    repository_id: String,
    profile_id: Option<String>,
) -> AppResult<Repository> {
    db.set_repository_profile(&repository_id, profile_id)
}

#[tauri::command]
pub fn remove_repository(db: State<'_, Database>, id: String) -> AppResult<()> {
    db.remove_repository(&id)
}

#[tauri::command]
pub fn get_repo_status(db: State<'_, Database>, repository_id: String) -> AppResult<RepoStatus> {
    let repo = require_repo(&db, &repository_id)?;
    git::status(std::path::Path::new(&repo.path))
}

#[tauri::command]
pub fn stage_paths(
    db: State<'_, Database>,
    repository_id: String,
    paths: Vec<String>,
) -> AppResult<RepoStatus> {
    let repo = require_repo(&db, &repository_id)?;
    git::stage(std::path::Path::new(&repo.path), &paths)?;
    git::status(std::path::Path::new(&repo.path))
}

#[tauri::command]
pub fn unstage_paths(
    db: State<'_, Database>,
    repository_id: String,
    paths: Vec<String>,
) -> AppResult<RepoStatus> {
    let repo = require_repo(&db, &repository_id)?;
    git::unstage(std::path::Path::new(&repo.path), &paths)?;
    git::status(std::path::Path::new(&repo.path))
}

#[tauri::command]
pub fn get_file_diff(
    db: State<'_, Database>,
    repository_id: String,
    path: String,
    staged: bool,
) -> AppResult<String> {
    let repo = require_repo(&db, &repository_id)?;
    git::diff(std::path::Path::new(&repo.path), &path, staged)
}

#[tauri::command]
pub fn commit_changes(db: State<'_, Database>, input: CommitInput) -> AppResult<CommitResult> {
    let repo = require_repo(&db, &input.repository_id)?;

    let (name, email) = resolve_identity(&db, &repo, &input)?;
    git::commit(std::path::Path::new(&repo.path), &input.message, &name, &email)
}

#[tauri::command]
pub fn init_repository(db: State<'_, Database>, path: String, bare: bool) -> AppResult<Repository> {
    let created = git::init_repository(std::path::Path::new(&path), bare)?;
    db.open_repository_path(&created.to_string_lossy())
}

#[tauri::command]
pub fn list_remotes(db: State<'_, Database>, repository_id: String) -> AppResult<Vec<RemoteInfo>> {
    let repo = require_repo(&db, &repository_id)?;
    git::list_remotes(std::path::Path::new(&repo.path))
}

#[tauri::command]
pub fn add_remote(
    db: State<'_, Database>,
    repository_id: String,
    name: String,
    url: String,
) -> AppResult<Vec<RemoteInfo>> {
    let repo = require_repo(&db, &repository_id)?;
    let path = std::path::Path::new(&repo.path);
    git::add_remote(path, &name, &url)?;
    git::list_remotes(path)
}

#[tauri::command]
pub fn remove_remote(
    db: State<'_, Database>,
    repository_id: String,
    name: String,
) -> AppResult<Vec<RemoteInfo>> {
    let repo = require_repo(&db, &repository_id)?;
    let path = std::path::Path::new(&repo.path);
    git::remove_remote(path, &name)?;
    git::list_remotes(path)
}

#[tauri::command]
pub fn cancel_operation(registry: State<'_, OperationRegistry>, operation_id: String) -> AppResult<()> {
    registry.cancel(&operation_id)
}

#[tauri::command]
pub fn respond_ssh_askpass(
    request_id: String,
    passphrase: Option<String>,
    cancelled: Option<bool>,
) -> AppResult<()> {
    if cancelled.unwrap_or(false) || passphrase.is_none() {
        return git::ssh_env::respond_askpass(&request_id, None);
    }
    git::ssh_env::respond_askpass(&request_id, passphrase.as_deref())
}

#[tauri::command]
pub async fn clone_repository(
    app: AppHandle,
    registry: State<'_, OperationRegistry>,
    db: State<'_, Database>,
    input: CloneInput,
) -> AppResult<Repository> {
    let args = git::clone_args(&input.url, &input.target_dir)?;
    crate::ops::run_streaming(&app, &registry, &input.operation_id, &args, None, None)?;
    db.open_repository_path(&input.target_dir)
}

#[tauri::command]
pub async fn fetch_remote(
    app: AppHandle,
    registry: State<'_, OperationRegistry>,
    db: State<'_, Database>,
    input: SyncInput,
) -> AppResult<RepoStatus> {
    let repo = require_repo(&db, &input.repository_id)?;
    let path = std::path::Path::new(&repo.path);
    ensure_has_remote(path)?;
    let remote = resolve_remote(path, input.remote.as_deref())?;
    git::reject_option_like(&remote)?;
    let args = git::fetch_args(Some(&remote));
    let key = resolve_ssh_key(&db, &repo, input.profile_id.as_deref());
    crate::ops::run_streaming(
        &app,
        &registry,
        &input.operation_id,
        &args,
        Some(path),
        key.as_deref(),
    )?;
    git::status(path)
}

#[tauri::command]
pub async fn pull_remote(
    app: AppHandle,
    registry: State<'_, OperationRegistry>,
    db: State<'_, Database>,
    input: SyncInput,
) -> AppResult<RepoStatus> {
    let repo = require_repo(&db, &input.repository_id)?;
    let path = std::path::Path::new(&repo.path);
    ensure_has_remote(path)?;
    let remote = resolve_remote(path, input.remote.as_deref())?;
    // Always pass remote+branch so pull works even without upstream tracking.
    let branch = input
        .branch
        .clone()
        .or_else(|| git::current_branch(path).ok().flatten())
        .ok_or_else(|| AppError::Message("Branch atual não encontrada para pull.".into()))?;
    git::reject_option_like(&remote)?;
    git::reject_option_like(&branch)?;
    let args = git::pull_args_with_opts(Some(&remote), Some(&branch), input.rebase);
    let key = resolve_ssh_key(&db, &repo, input.profile_id.as_deref());
    crate::ops::run_streaming(
        &app,
        &registry,
        &input.operation_id,
        &args,
        Some(path),
        key.as_deref(),
    )?;
    git::status(path)
}

#[tauri::command]
pub async fn push_remote(
    app: AppHandle,
    registry: State<'_, OperationRegistry>,
    db: State<'_, Database>,
    input: SyncInput,
) -> AppResult<String> {
    let repo = require_repo(&db, &input.repository_id)?;
    let path = std::path::Path::new(&repo.path);
    ensure_has_remote(path)?;
    let remote = resolve_remote(path, input.remote.as_deref())?;
    let branch = input
        .branch
        .clone()
        .or_else(|| git::current_branch(path).ok().flatten())
        .ok_or_else(|| AppError::Message("Branch atual não encontrada para push.".into()))?;
    git::reject_option_like(&remote)?;
    git::reject_option_like(&branch)?;
    let args = git::push_args(Some(&remote), Some(&branch), input.set_upstream);
    let key = resolve_ssh_key(&db, &repo, input.profile_id.as_deref());
    crate::ops::run_streaming(
        &app,
        &registry,
        &input.operation_id,
        &args,
        Some(path),
        key.as_deref(),
    )
}

fn ensure_has_remote(path: &std::path::Path) -> AppResult<()> {
    let remotes = git::list_remotes(path)?;
    if remotes.is_empty() {
        return Err(AppError::Message(
            "Nenhum remote configurado. Adicione um remote (ex.: origin) na aba Changes antes de Pull/Push/Fetch.".into(),
        ));
    }
    Ok(())
}

fn resolve_remote(path: &std::path::Path, preferred: Option<&str>) -> AppResult<String> {
    let remotes = git::list_remotes(path)?;
    if let Some(name) = preferred {
        if remotes.iter().any(|r| r.name == name) {
            return Ok(name.to_string());
        }
    }
    if let Some(origin) = remotes.iter().find(|r| r.name == "origin") {
        return Ok(origin.name.clone());
    }
    remotes
        .first()
        .map(|r| r.name.clone())
        .ok_or_else(|| AppError::Message("Nenhum remote disponível.".into()))
}

#[tauri::command]
pub fn get_commit_graph(
    db: State<'_, Database>,
    repository_id: String,
    limit: Option<usize>,
) -> AppResult<CommitGraph> {
    let repo = require_repo(&db, &repository_id)?;
    git::commit_graph(std::path::Path::new(&repo.path), limit.unwrap_or(120))
}

#[tauri::command]
pub fn search_commits(
    db: State<'_, Database>,
    repository_id: String,
    query: String,
    limit: Option<usize>,
) -> AppResult<Vec<CommitSummary>> {
    let repo = require_repo(&db, &repository_id)?;
    git::search_commits(
        std::path::Path::new(&repo.path),
        &query,
        limit.unwrap_or(80),
    )
}

#[tauri::command]
pub fn get_commit_files(
    db: State<'_, Database>,
    repository_id: String,
    hash: String,
) -> AppResult<Vec<CommitFileChange>> {
    let repo = require_repo(&db, &repository_id)?;
    git::commit_files(std::path::Path::new(&repo.path), &hash)
}

#[tauri::command]
pub fn get_commit_file_diff(
    db: State<'_, Database>,
    repository_id: String,
    hash: String,
    path: String,
) -> AppResult<String> {
    let repo = require_repo(&db, &repository_id)?;
    git::commit_file_diff(std::path::Path::new(&repo.path), &hash, &path)
}

#[tauri::command]
pub fn get_file_at_commit(
    db: State<'_, Database>,
    repository_id: String,
    hash: String,
    path: String,
) -> AppResult<String> {
    let repo = require_repo(&db, &repository_id)?;
    git::file_at_commit(std::path::Path::new(&repo.path), &hash, &path)
}

#[tauri::command]
pub fn list_branches(db: State<'_, Database>, repository_id: String) -> AppResult<Vec<BranchInfo>> {
    let repo = require_repo(&db, &repository_id)?;
    git::list_branches(std::path::Path::new(&repo.path))
}

#[tauri::command]
pub fn list_tags(db: State<'_, Database>, repository_id: String) -> AppResult<Vec<TagInfo>> {
    let repo = require_repo(&db, &repository_id)?;
    git::list_tags(std::path::Path::new(&repo.path))
}

#[tauri::command]
pub fn create_branch(
    db: State<'_, Database>,
    repository_id: String,
    name: String,
    checkout: bool,
    start_point: Option<String>,
) -> AppResult<Vec<BranchInfo>> {
    let repo = require_repo(&db, &repository_id)?;
    let path = std::path::Path::new(&repo.path);
    git::create_branch_at(path, &name, checkout, start_point.as_deref())?;
    git::list_branches(path)
}

#[tauri::command]
pub fn reset_to_commit(
    db: State<'_, Database>,
    repository_id: String,
    commit: String,
    mode: String,
) -> AppResult<RepoStatus> {
    let repo = require_repo(&db, &repository_id)?;
    let path = std::path::Path::new(&repo.path);
    git::reset_to_commit(path, &commit, &mode)?;
    git::status(path)
}

#[tauri::command]
pub fn revert_commit(
    db: State<'_, Database>,
    repository_id: String,
    commit: String,
) -> AppResult<RepoStatus> {
    let repo = require_repo(&db, &repository_id)?;
    let path = std::path::Path::new(&repo.path);
    git::revert_commit(path, &commit)?;
    git::status(path)
}

#[tauri::command]
pub fn checkout_branch(
    db: State<'_, Database>,
    repository_id: String,
    name: String,
    force: Option<bool>,
) -> AppResult<Vec<BranchInfo>> {
    let repo = require_repo(&db, &repository_id)?;
    let path = std::path::Path::new(&repo.path);
    if force.unwrap_or(false) {
        git::checkout_branch_force(path, &name)?;
    } else {
        git::checkout_branch(path, &name)?;
    }
    git::list_branches(path)
}

#[tauri::command]
pub fn rename_branch(
    db: State<'_, Database>,
    repository_id: String,
    old_name: String,
    new_name: String,
) -> AppResult<Vec<BranchInfo>> {
    let repo = require_repo(&db, &repository_id)?;
    let path = std::path::Path::new(&repo.path);
    git::rename_branch(path, &old_name, &new_name)?;
    git::list_branches(path)
}

#[tauri::command]
pub fn delete_branch(
    db: State<'_, Database>,
    repository_id: String,
    name: String,
    force: bool,
) -> AppResult<Vec<BranchInfo>> {
    let repo = require_repo(&db, &repository_id)?;
    let path = std::path::Path::new(&repo.path);
    git::delete_branch(path, &name, force)?;
    git::list_branches(path)
}

#[tauri::command]
pub fn get_upstream_status(
    db: State<'_, Database>,
    repository_id: String,
) -> AppResult<UpstreamStatus> {
    let repo = require_repo(&db, &repository_id)?;
    git::upstream_status(std::path::Path::new(&repo.path))
}

#[tauri::command]
pub fn list_stash(db: State<'_, Database>, repository_id: String) -> AppResult<Vec<StashEntry>> {
    let repo = require_repo(&db, &repository_id)?;
    git::list_stash(std::path::Path::new(&repo.path))
}

#[tauri::command]
pub fn create_stash(
    db: State<'_, Database>,
    repository_id: String,
    message: Option<String>,
    include_untracked: bool,
) -> AppResult<Vec<StashEntry>> {
    let repo = require_repo(&db, &repository_id)?;
    let path = std::path::Path::new(&repo.path);
    git::create_stash(path, message.as_deref(), include_untracked)?;
    git::list_stash(path)
}

#[tauri::command]
pub fn apply_stash(
    db: State<'_, Database>,
    repository_id: String,
    selector: String,
    pop: bool,
) -> AppResult<RepoStatus> {
    let repo = require_repo(&db, &repository_id)?;
    let path = std::path::Path::new(&repo.path);
    git::apply_stash(path, &selector, pop)?;
    git::status(path)
}

#[tauri::command]
pub fn drop_stash(
    db: State<'_, Database>,
    repository_id: String,
    selector: String,
) -> AppResult<Vec<StashEntry>> {
    let repo = require_repo(&db, &repository_id)?;
    let path = std::path::Path::new(&repo.path);
    git::drop_stash(path, &selector)?;
    git::list_stash(path)
}

#[tauri::command]
pub fn merge_branch(
    db: State<'_, Database>,
    repository_id: String,
    branch: String,
) -> AppResult<IntegrateResult> {
    let repo = require_repo(&db, &repository_id)?;
    git::merge_branch(std::path::Path::new(&repo.path), &branch)
}

#[tauri::command]
pub fn cherry_pick_commit(
    db: State<'_, Database>,
    repository_id: String,
    commit: String,
) -> AppResult<IntegrateResult> {
    let repo = require_repo(&db, &repository_id)?;
    git::cherry_pick(std::path::Path::new(&repo.path), &commit)
}

#[tauri::command]
pub fn rebase_onto(
    db: State<'_, Database>,
    repository_id: String,
    upstream: String,
) -> AppResult<IntegrateResult> {
    let repo = require_repo(&db, &repository_id)?;
    git::rebase_onto(std::path::Path::new(&repo.path), &upstream)
}

#[tauri::command]
pub fn abort_integrate(
    db: State<'_, Database>,
    repository_id: String,
) -> AppResult<IntegrateState> {
    let repo = require_repo(&db, &repository_id)?;
    git::abort_integrate(std::path::Path::new(&repo.path))
}

#[tauri::command]
pub fn continue_integrate(
    db: State<'_, Database>,
    repository_id: String,
) -> AppResult<IntegrateResult> {
    let repo = require_repo(&db, &repository_id)?;
    git::continue_integrate(std::path::Path::new(&repo.path))
}

#[tauri::command]
pub fn resolve_conflict(
    db: State<'_, Database>,
    repository_id: String,
    path: String,
    strategy: String,
    content: Option<String>,
) -> AppResult<IntegrateState> {
    let repo = require_repo(&db, &repository_id)?;
    git::resolve_conflict(
        std::path::Path::new(&repo.path),
        &path,
        &strategy,
        content.as_deref(),
    )
}

#[tauri::command]
pub fn read_conflict_file(
    db: State<'_, Database>,
    repository_id: String,
    path: String,
) -> AppResult<String> {
    let repo = require_repo(&db, &repository_id)?;
    git::read_worktree_file(std::path::Path::new(&repo.path), &path)
}

#[tauri::command]
pub fn read_conflict_sides(
    db: State<'_, Database>,
    repository_id: String,
    path: String,
) -> AppResult<crate::domain::ConflictFileSides> {
    let repo = require_repo(&db, &repository_id)?;
    git::read_conflict_sides(std::path::Path::new(&repo.path), &path)
}

#[tauri::command]
pub fn list_repo_files(
    db: State<'_, Database>,
    repository_id: String,
) -> AppResult<Vec<String>> {
    let repo = require_repo(&db, &repository_id)?;
    let raw = git::run_git(
        &["ls-files", "-z"],
        Some(std::path::Path::new(&repo.path)),
    )?;
    Ok(raw
        .split('\0')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .collect())
}

#[tauri::command]
pub fn terminal_create(
    app: AppHandle,
    terminals: State<'_, TerminalRegistry>,
    db: State<'_, Database>,
    repository_id: Option<String>,
    cols: u16,
    rows: u16,
) -> AppResult<String> {
    let cwd = if let Some(id) = repository_id {
        let repo = require_repo(&db, &id)?;
        Some(std::path::PathBuf::from(repo.path))
    } else {
        None
    };
    terminals.create(app, cwd.as_deref(), cols, rows)
}

#[tauri::command]
pub fn terminal_write(
    terminals: State<'_, TerminalRegistry>,
    session_id: String,
    data: String,
) -> AppResult<()> {
    terminals.write(&session_id, &data)
}

#[tauri::command]
pub fn terminal_resize(
    terminals: State<'_, TerminalRegistry>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> AppResult<()> {
    terminals.resize(&session_id, cols, rows)
}

#[tauri::command]
pub fn terminal_kill(
    terminals: State<'_, TerminalRegistry>,
    session_id: String,
) -> AppResult<()> {
    terminals.kill(&session_id)
}

#[tauri::command]
pub fn terminal_set_enabled(
    terminals: State<'_, TerminalRegistry>,
    enabled: bool,
) -> AppResult<()> {
    terminals.set_enabled(enabled);
    Ok(())
}

#[tauri::command]
pub fn terminal_kill_all(terminals: State<'_, TerminalRegistry>) -> AppResult<()> {
    terminals.kill_all()
}

fn require_repo(db: &Database, id: &str) -> AppResult<Repository> {
    db.get_repository(id)?
        .ok_or_else(|| AppError::Message("Repositório não encontrado.".into()))
}

fn resolve_ssh_key(
    db: &Database,
    repo: &Repository,
    profile_id: Option<&str>,
) -> Option<std::path::PathBuf> {
    let id = profile_id
        .map(str::to_string)
        .or_else(|| repo.default_profile_id.clone())?;
    let profile = db.get_profile(&id).ok().flatten()?;
    let path = profile.ssh_key_path?.trim().to_string();
    if path.is_empty() {
        return None;
    }
    if git::validate_ssh_key_path(&path).is_err() {
        return None;
    }
    let p = std::path::PathBuf::from(path);
    if p.is_file() {
        Some(p)
    } else {
        None
    }
}

fn validate_profile_ssh_key(path: Option<&str>) -> AppResult<()> {
    if let Some(p) = path.map(str::trim).filter(|s| !s.is_empty()) {
        git::validate_ssh_key_path(p)?;
    }
    Ok(())
}

fn resolve_identity(
    db: &Database,
    repo: &Repository,
    input: &CommitInput,
) -> AppResult<(String, String)> {
    if let (Some(name), Some(email)) = (&input.author_name, &input.author_email) {
        if !name.trim().is_empty() && !email.trim().is_empty() {
            return Ok((name.trim().to_string(), email.trim().to_string()));
        }
    }

    if let Some(profile_id) = &input.profile_id {
        if let Some(profile) = db.get_profile(profile_id)? {
            return Ok((profile.name, profile.email));
        }
    }

    if let Some(profile) = &repo.active_profile {
        return Ok((profile.name.clone(), profile.email.clone()));
    }

    Err(AppError::Message(
        "Selecione um perfil (nome/email) antes de commitar.".into(),
    ))
}
