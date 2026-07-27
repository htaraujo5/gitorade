mod commands;
mod credentials;
pub mod domain;
pub mod error;
pub mod git;
mod ops;
mod process_util;
mod storage;
mod terminal;
mod watcher;

use ops::OperationRegistry;
use storage::Database;
use terminal::TerminalRegistry;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let database = Database::open_default().expect("failed to open database");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(database)
        .manage(OperationRegistry::default())
        .manage(TerminalRegistry::default())
        .setup(|app| {
            git::ssh_env::start_askpass_bridge(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_app_health,
            commands::respond_ssh_askpass,
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
            commands::get_commit_graph,
            commands::search_commits,
            commands::get_commit_files,
            commands::get_commit_file_diff,
            commands::get_file_at_commit,
            commands::list_branches,
            commands::create_branch,
            commands::checkout_branch,
            commands::rename_branch,
            commands::delete_branch,
            commands::reset_to_commit,
            commands::revert_commit,
            commands::get_upstream_status,
            commands::list_stash,
            commands::create_stash,
            commands::apply_stash,
            commands::drop_stash,
            commands::merge_branch,
            commands::cherry_pick_commit,
            commands::rebase_onto,
            commands::abort_integrate,
            commands::continue_integrate,
            commands::resolve_conflict,
            commands::read_conflict_file,
            commands::read_conflict_sides,
            commands::list_repo_files,
            commands::terminal_create,
            commands::terminal_write,
            commands::terminal_resize,
            commands::terminal_kill,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
