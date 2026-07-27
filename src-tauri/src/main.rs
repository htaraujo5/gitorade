// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // SSH/OpenSSH re-executes this EXE as askpass (env set by apply_git_remote_env).
    // Must stay headless — no UI, no console window.
    if std::env::var_os(gitorade_lib::git::ssh_env::ASKPASS_ENV)
        .is_some_and(|v| v == "1")
    {
        std::process::exit(gitorade_lib::git::ssh_env::run_askpass_cli());
    }
    gitorade_lib::run()
}
