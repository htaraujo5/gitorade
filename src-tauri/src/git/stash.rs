use std::path::Path;

use crate::domain::StashEntry;
use crate::error::{AppError, AppResult};
use crate::git::run_git;

pub fn list_stash(path: &Path) -> AppResult<Vec<StashEntry>> {
    let raw = match run_git(
        &["stash", "list", "--format=%gd%x00%s%x00%aI"],
        Some(path),
    ) {
        Ok(s) => s,
        Err(_) => return Ok(Vec::new()),
    };

    let mut entries = Vec::new();
    for (index, line) in raw.lines().enumerate() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let parts: Vec<&str> = line.split('\0').collect();
        let selector = parts.first().copied().unwrap_or("").to_string();
        let message = parts.get(1).copied().unwrap_or("").to_string();
        let authored_at = parts
            .get(2)
            .copied()
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string());

        entries.push(StashEntry {
            index: index as u32,
            selector,
            message,
            authored_at,
        });
    }
    Ok(entries)
}

pub fn create_stash(path: &Path, message: Option<&str>, include_untracked: bool) -> AppResult<()> {
    let mut args: Vec<String> = vec!["stash".into(), "push".into()];
    if include_untracked {
        args.push("-u".into());
    }
    if let Some(msg) = message.map(str::trim).filter(|s| !s.is_empty()) {
        args.push("-m".into());
        args.push(msg.to_string());
    }
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    run_git(&refs, Some(path))?;
    Ok(())
}

pub fn apply_stash(path: &Path, selector: &str, pop: bool) -> AppResult<()> {
    let selector = selector.trim();
    if selector.is_empty() {
        return Err(AppError::Message("Seletor de stash inválido.".into()));
    }
    let cmd = if pop { "pop" } else { "apply" };
    run_git(&["stash", cmd, selector], Some(path))?;
    Ok(())
}

pub fn drop_stash(path: &Path, selector: &str) -> AppResult<()> {
    let selector = selector.trim();
    if selector.is_empty() {
        return Err(AppError::Message("Seletor de stash inválido.".into()));
    }
    run_git(&["stash", "drop", selector], Some(path))?;
    Ok(())
}
