mod commands;
mod credentials;
mod domain;
mod error;
mod git;
mod ops;
mod storage;
mod watcher;

use ops::OperationRegistry;
use storage::Database;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let database = Database::open_default().expect("failed to open database");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(database)
        .manage(OperationRegistry::default())
        .invoke_handler(tauri::generate_handler![
            commands::get_app_health,
            commands::list_profiles,
            commands::create_profile,
            commands::update_profile,
            commands::delete_profile,
            commands::list_repositories,
            commands::open_repository,
            commands::set_repository_favorite,
            commands::set_repository_profile,
            commands::remove_repository,
            commands::get_repo_status,
            commands::stage_paths,
            commands::unstage_paths,
            commands::get_file_diff,
            commands::commit_changes,
            commands::init_repository,
            commands::list_remotes,
            commands::add_remote,
            commands::remove_remote,
            commands::cancel_operation,
            commands::clone_repository,
            commands::fetch_remote,
            commands::pull_remote,
            commands::push_remote,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
