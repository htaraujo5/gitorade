use tauri::{AppHandle, State};

use crate::domain::{
    AppHealth, CloneInput, CommitInput, CommitResult, CreateProfileInput, Profile, RemoteInfo,
    RepoStatus, Repository, SyncInput, UpdateProfileInput,
};
use crate::error::{AppError, AppResult};
use crate::git;
use crate::ops::OperationRegistry;
use crate::storage::Database;

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
    db.create_profile(input)
}

#[tauri::command]
pub fn update_profile(db: State<'_, Database>, input: UpdateProfileInput) -> AppResult<Profile> {
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
pub async fn clone_repository(
    app: AppHandle,
    registry: State<'_, OperationRegistry>,
    db: State<'_, Database>,
    input: CloneInput,
) -> AppResult<Repository> {
    let args = git::clone_args(&input.url, &input.target_dir);
    crate::ops::run_streaming(&app, &registry, &input.operation_id, &args, None)?;
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
    let path = repo.path.clone();
    let args = git::fetch_args(input.remote.as_deref());
    crate::ops::run_streaming(
        &app,
        &registry,
        &input.operation_id,
        &args,
        Some(std::path::Path::new(&path)),
    )?;
    git::status(std::path::Path::new(&path))
}

#[tauri::command]
pub async fn pull_remote(
    app: AppHandle,
    registry: State<'_, OperationRegistry>,
    db: State<'_, Database>,
    input: SyncInput,
) -> AppResult<RepoStatus> {
    let repo = require_repo(&db, &input.repository_id)?;
    let path = repo.path.clone();
    let args = git::pull_args(input.remote.as_deref(), input.branch.as_deref());
    crate::ops::run_streaming(
        &app,
        &registry,
        &input.operation_id,
        &args,
        Some(std::path::Path::new(&path)),
    )?;
    git::status(std::path::Path::new(&path))
}

#[tauri::command]
pub async fn push_remote(
    app: AppHandle,
    registry: State<'_, OperationRegistry>,
    db: State<'_, Database>,
    input: SyncInput,
) -> AppResult<String> {
    let repo = require_repo(&db, &input.repository_id)?;
    let path = repo.path.clone();
    let args = git::push_args(
        input.remote.as_deref(),
        input.branch.as_deref(),
        input.set_upstream,
    );
    crate::ops::run_streaming(
        &app,
        &registry,
        &input.operation_id,
        &args,
        Some(std::path::Path::new(&path)),
    )
}

fn require_repo(db: &Database, id: &str) -> AppResult<Repository> {
    db.get_repository(id)?
        .ok_or_else(|| AppError::Message("Repositório não encontrado.".into()))
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
        "Nenhum perfil associado. Crie/associe uma identidade antes do commit.".into(),
    ))
}
