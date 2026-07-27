use std::path::Path;

use crate::domain::{BranchInfo, UpstreamStatus};
use crate::error::{AppError, AppResult};
use crate::git::run_git;

pub fn list_branches(path: &Path) -> AppResult<Vec<BranchInfo>> {
    let raw = run_git(
        &[
            "for-each-ref",
            "--format=%(refname)%00%(refname:short)%00%(objectname:short)%00%(upstream:short)%00%(upstream:track,nobracket)%00%(HEAD)",
            "refs/heads",
            "refs/remotes",
        ],
        Some(path),
    )?;

    let mut branches = Vec::new();
    for line in raw.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let parts: Vec<&str> = line.split('\0').collect();
        if parts.len() < 6 {
            continue;
        }
        let full = parts[0];
        let name = parts[1].to_string();
        if name == "origin/HEAD" || name.ends_with("/HEAD") {
            continue;
        }
        let is_remote = full.starts_with("refs/remotes/");
        let tip_hash = if parts[2].is_empty() {
            None
        } else {
            Some(parts[2].to_string())
        };
        let upstream = if parts[3].is_empty() {
            None
        } else {
            Some(parts[3].to_string())
        };
        let (ahead, behind) = parse_track(parts[4]);
        let is_current = parts[5] == "*";

        branches.push(BranchInfo {
            name,
            is_remote,
            is_current,
            is_head: is_current,
            upstream,
            ahead,
            behind,
            tip_hash,
        });
    }

    branches.sort_by(|a, b| {
        b.is_current
            .cmp(&a.is_current)
            .then(a.is_remote.cmp(&b.is_remote))
            .then(a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(branches)
}

fn parse_track(track: &str) -> (Option<u32>, Option<u32>) {
    // e.g. "ahead 2, behind 3" or "ahead 1" or "behind 4"
    let mut ahead = None;
    let mut behind = None;
    let lower = track.to_lowercase();
    if let Some(idx) = lower.find("ahead ") {
        ahead = lower[idx + 6..]
            .split(|c: char| !c.is_ascii_digit())
            .next()
            .and_then(|s| s.parse().ok());
    }
    if let Some(idx) = lower.find("behind ") {
        behind = lower[idx + 7..]
            .split(|c: char| !c.is_ascii_digit())
            .next()
            .and_then(|s| s.parse().ok());
    }
    (ahead, behind)
}

pub fn create_branch(path: &Path, name: &str, checkout: bool) -> AppResult<()> {
    create_branch_at(path, name, checkout, None)
}

pub fn create_branch_at(
    path: &Path,
    name: &str,
    checkout: bool,
    start_point: Option<&str>,
) -> AppResult<()> {
    let name = name.trim();
    if name.is_empty() {
        return Err(AppError::Message("Nome da branch é obrigatório.".into()));
    }
    let start = start_point.map(str::trim).filter(|s| !s.is_empty());
    match (checkout, start) {
        (true, Some(sp)) => {
            run_git(&["checkout", "-b", name, sp], Some(path))?;
        }
        (true, None) => {
            run_git(&["checkout", "-b", name], Some(path))?;
        }
        (false, Some(sp)) => {
            run_git(&["branch", name, sp], Some(path))?;
        }
        (false, None) => {
            run_git(&["branch", name], Some(path))?;
        }
    }
    Ok(())
}

/// Soft / mixed / hard reset of HEAD to `commit`.
pub fn reset_to_commit(path: &Path, commit: &str, mode: &str) -> AppResult<()> {
    let commit = commit.trim();
    if commit.is_empty() {
        return Err(AppError::Message("Commit obrigatório.".into()));
    }
    let flag = match mode {
        "soft" => "--soft",
        "hard" => "--hard",
        "mixed" | "" => "--mixed",
        other => {
            return Err(AppError::Message(format!(
                "Modo de reset inválido: {other}. Use soft, mixed ou hard."
            )));
        }
    };
    run_git(&["reset", flag, commit], Some(path))?;
    Ok(())
}

/// Create a revert commit for `commit` (no edit).
pub fn revert_commit(path: &Path, commit: &str) -> AppResult<()> {
    let commit = commit.trim();
    if commit.is_empty() {
        return Err(AppError::Message("Commit obrigatório.".into()));
    }
    run_git(&["revert", "--no-edit", commit], Some(path))?;
    Ok(())
}

pub fn checkout_branch(path: &Path, name: &str) -> AppResult<()> {
    checkout_branch_with_opts(path, name, false)
}

pub fn checkout_branch_force(path: &Path, name: &str) -> AppResult<()> {
    checkout_branch_with_opts(path, name, true)
}

fn checkout_branch_with_opts(path: &Path, name: &str, force: bool) -> AppResult<()> {
    let name = name.trim();
    if name.is_empty() {
        return Err(AppError::Message("Nome da branch é obrigatório.".into()));
    }

    let do_checkout = |branch: &str| -> AppResult<()> {
        if force {
            run_git(&["checkout", "-f", branch], Some(path))?;
        } else {
            run_git(&["checkout", branch], Some(path))?;
        }
        Ok(())
    };

    // Exact local branch first (feat/melhorias must NOT be treated as remote/feat).
    let local_full = format!("refs/heads/{name}");
    if run_git(
        &["show-ref", "--verify", "--quiet", &local_full],
        Some(path),
    )
    .is_ok()
    {
        do_checkout(name)?;
        return Ok(());
    }

    // Remote-tracking only when the first segment is a configured remote (origin/…).
    if let Some((remote, short)) = name.split_once('/') {
        if remote != "refs" && is_configured_remote(path, remote) {
            let local_short = format!("refs/heads/{short}");
            if run_git(
                &["show-ref", "--verify", "--quiet", &local_short],
                Some(path),
            )
            .is_ok()
            {
                do_checkout(short)?;
            } else if force {
                run_git(&["checkout", "-f", "-B", short, name], Some(path))?;
            } else {
                run_git(&["checkout", "--track", name], Some(path)).or_else(|_| {
                    run_git(&["checkout", "-b", short, name], Some(path))
                })?;
            }
            return Ok(());
        }
    }

    do_checkout(name)?;
    Ok(())
}

fn is_configured_remote(path: &Path, name: &str) -> bool {
    crate::git::list_remotes(path)
        .map(|rs| rs.iter().any(|r| r.name == name))
        .unwrap_or(false)
}

pub fn rename_branch(path: &Path, old: &str, new: &str) -> AppResult<()> {
    let old = old.trim();
    let new = new.trim();
    if old.is_empty() || new.is_empty() {
        return Err(AppError::Message("Nomes de branch são obrigatórios.".into()));
    }
    run_git(&["branch", "-m", old, new], Some(path))?;
    Ok(())
}

pub fn delete_branch(path: &Path, name: &str, force: bool) -> AppResult<()> {
    let name = name.trim();
    if name.is_empty() {
        return Err(AppError::Message("Nome da branch é obrigatório.".into()));
    }
    if name.contains('/') {
        // remote delete: git push remote --delete branch — deferred; only local for now
        return Err(AppError::Message(
            "Exclusão de branch remota ainda não suportada nesta versão.".into(),
        ));
    }
    let flag = if force { "-D" } else { "-d" };
    run_git(&["branch", flag, name], Some(path))?;
    Ok(())
}

pub fn upstream_status(path: &Path) -> AppResult<UpstreamStatus> {
    let branch = crate::git::current_branch(path)?;
    upstream_status_for_branch(path, branch)
}

pub fn upstream_status_for_branch(
    path: &Path,
    branch: Option<String>,
) -> AppResult<UpstreamStatus> {
    let upstream = run_git(
        &["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"],
        Some(path),
    )
    .ok()
    .filter(|s| !s.is_empty());

    let (ahead, behind) = if upstream.is_some() {
        match run_git(
            &["rev-list", "--left-right", "--count", "@{upstream}...HEAD"],
            Some(path),
        ) {
            Ok(raw) => {
                let mut parts = raw.split_whitespace();
                let behind = parts.next().and_then(|s| s.parse().ok()).unwrap_or(0);
                let ahead = parts.next().and_then(|s| s.parse().ok()).unwrap_or(0);
                (ahead, behind)
            }
            Err(_) => (0, 0),
        }
    } else {
        (0, 0)
    };

    Ok(UpstreamStatus {
        branch,
        upstream,
        ahead,
        behind,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_track_ahead_behind() {
        assert_eq!(parse_track("ahead 2, behind 3"), (Some(2), Some(3)));
        assert_eq!(parse_track("ahead 1"), (Some(1), None));
        assert_eq!(parse_track("behind 4"), (None, Some(4)));
        assert_eq!(parse_track(""), (None, None));
    }
}
