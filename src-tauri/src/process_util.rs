//! Helpers for spawning subprocesses without flashing a console on Windows.

use std::process::Command;

/// Hide the console window for CLI tools (git, powershell, where, …).
///
/// Tauri is a GUI process; without this flag, every `Command::output()` /
/// `spawn()` of a console-subsystem binary opens a visible terminal briefly.
pub fn hide_console(cmd: &mut Command) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    let _ = cmd;
}
