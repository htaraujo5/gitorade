//! Merge, rebase and cherry-pick operations (non-interactive).

use std::path::Path;
use std::process::Command;

use crate::domain::{IntegrateResult, IntegrateState};
use crate::error::{AppError, AppResult};
use super::{redact_secrets, run_git, stage};

/// Detect whether a merge/rebase/cherry-pick is in progress and list conflicts.
pub fn detect_state(path: &Path) -> AppResult<IntegrateState> {
    let kind = if path.join(".git/MERGE_HEAD").exists() {
        Some("merge".into())
    } else if path.join(".git/REBASE_HEAD").exists()
        || path.join(".git/rebase-merge").exists()
        || path.join(".git/rebase-apply").exists()
    {
        Some("rebase".into())
    } else if path.join(".git/CHERRY_PICK_HEAD").exists() {
        Some("cherry-pick".into())
    } else {
        None
    };

    // Skip conflict scan when idle — avoids an extra git process on every status.
    let conflicts = if kind.is_some() {
        list_conflicts(path)?
    } else {
        Vec::new()
    };
    Ok(IntegrateState { kind, conflicts })
}

pub fn list_conflicts(path: &Path) -> AppResult<Vec<String>> {
    // --diff-filter=U lists unmerged paths
    let out = run_git(&["diff", "--name-only", "--diff-filter=U", "-z"], Some(path))?;
    Ok(out
        .split('\0')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .collect())
}

/// Merge `branch` into HEAD. Returns conflict state when merge stops for resolution.
pub fn merge_branch(path: &Path, branch: &str) -> AppResult<IntegrateResult> {
    let branch = branch.trim();
    if branch.is_empty() {
        return Err(AppError::Message("Nome da branch vazio.".into()));
    }
    ensure_clean_for_start(path)?;

    let result = run_git_allow_conflict(
        &["merge", "--no-edit", "--no-ff", branch],
        Some(path),
    )?;
    to_integrate_result(path, "merge", result)
}

pub fn cherry_pick(path: &Path, commit: &str) -> AppResult<IntegrateResult> {
    let commit = commit.trim();
    if commit.is_empty() {
        return Err(AppError::Message("Hash do commit vazio.".into()));
    }
    ensure_clean_for_start(path)?;

    let result = run_git_allow_conflict(&["cherry-pick", "--ff", commit], Some(path))?;
    to_integrate_result(path, "cherry-pick", result)
}

pub fn rebase_onto(path: &Path, upstream: &str) -> AppResult<IntegrateResult> {
    let upstream = upstream.trim();
    if upstream.is_empty() {
        return Err(AppError::Message("Upstream vazio.".into()));
    }
    ensure_clean_for_start(path)?;

    let result = run_git_allow_conflict(&["rebase", upstream], Some(path))?;
    to_integrate_result(path, "rebase", result)
}

pub fn abort_integrate(path: &Path) -> AppResult<IntegrateState> {
    let state = detect_state(path)?;
    match state.kind.as_deref() {
        Some("merge") => {
            run_git(&["merge", "--abort"], Some(path))?;
        }
        Some("rebase") => {
            run_git(&["rebase", "--abort"], Some(path))?;
        }
        Some("cherry-pick") => {
            run_git(&["cherry-pick", "--abort"], Some(path))?;
        }
        _ => {
            return Err(AppError::Message(
                "Nenhuma operação de merge/rebase/cherry-pick em andamento.".into(),
            ));
        }
    }
    detect_state(path)
}

pub fn continue_integrate(path: &Path) -> AppResult<IntegrateResult> {
    let state = detect_state(path)?;
    let conflicts = list_conflicts(path)?;
    if !conflicts.is_empty() {
        return Err(AppError::Message(format!(
            "Ainda há {} arquivo(s) em conflito. Resolva antes de continuar.",
            conflicts.len()
        )));
    }

    let result = match state.kind.as_deref() {
        Some("merge") => {
            let mut cmd = Command::new("git");
            crate::process_util::hide_console(&mut cmd);
            cmd.current_dir(path)
                .env("GIT_EDITOR", "true")
                .args(["merge", "--continue"]);
            allow_conflict_output(cmd)?
        }
        Some("rebase") => {
            // Non-interactive: skip editor
            let mut cmd = Command::new("git");
            crate::process_util::hide_console(&mut cmd);
            cmd.current_dir(path)
                .env("GIT_EDITOR", "true")
                .args(["rebase", "--continue"]);
            allow_conflict_output(cmd)?
        }
        Some("cherry-pick") => {
            let mut cmd = Command::new("git");
            crate::process_util::hide_console(&mut cmd);
            cmd.current_dir(path)
                .env("GIT_EDITOR", "true")
                .args(["cherry-pick", "--continue"]);
            allow_conflict_output(cmd)?
        }
        _ => {
            return Err(AppError::Message(
                "Nenhuma operação de merge/rebase/cherry-pick em andamento.".into(),
            ));
        }
    };

    let kind = state.kind.as_deref().unwrap_or("merge");
    to_integrate_result(path, kind, result)
}

/// Resolve a conflicted file using ours, theirs, or explicit content.
pub fn resolve_conflict(
    path: &Path,
    file_path: &str,
    strategy: &str,
    content: Option<&str>,
) -> AppResult<IntegrateState> {
    match strategy {
        "ours" => {
            run_git(&["checkout", "--ours", "--", file_path], Some(path))?;
            stage(path, &[file_path.to_string()])?;
        }
        "theirs" => {
            run_git(&["checkout", "--theirs", "--", file_path], Some(path))?;
            stage(path, &[file_path.to_string()])?;
        }
        "content" => {
            let body = content.ok_or_else(|| {
                AppError::Message("Conteúdo obrigatório para resolução manual.".into())
            })?;
            let full = path.join(file_path);
            if let Some(parent) = full.parent() {
                std::fs::create_dir_all(parent)?;
            }
            std::fs::write(&full, body)?;
            stage(path, &[file_path.to_string()])?;
        }
        other => {
            return Err(AppError::Message(format!(
                "Estratégia desconhecida: {other}. Use ours, theirs ou content."
            )));
        }
    }
    detect_state(path)
}

pub fn read_file(path: &Path, file_path: &str) -> AppResult<String> {
    let full = path.join(file_path);
    let bytes = std::fs::read(&full).map_err(AppError::Io)?;
    Ok(String::from_utf8_lossy(&bytes).to_string())
}

/// Ours (:2:) / theirs (:3:) / worktree (with markers) for the 3-way editor.
pub fn read_conflict_sides(
    path: &Path,
    file_path: &str,
) -> AppResult<crate::domain::ConflictFileSides> {
    let show = |stage: &str| -> String {
        let spec = format!("{stage}:{file_path}");
        run_git(&["show", &spec], Some(path)).unwrap_or_default()
    };

    let ours = show(":2");
    let theirs = show(":3");
    let merged = read_file(path, file_path).unwrap_or_else(|_| {
        // Fall back to concatenating sides if worktree missing
        if ours.is_empty() && theirs.is_empty() {
            String::new()
        } else {
            format!("{ours}\n<<<<<<<\n=======\n>>>>>>>\n{theirs}")
        }
    });

    Ok(crate::domain::ConflictFileSides {
        path: file_path.to_string(),
        ours,
        theirs,
        merged,
    })
}

fn ensure_clean_for_start(path: &Path) -> AppResult<()> {
    let state = detect_state(path)?;
    if state.kind.is_some() {
        return Err(AppError::Message(format!(
            "Já existe uma operação {} em andamento. Continue ou aborte antes.",
            state.kind.unwrap()
        )));
    }
    Ok(())
}

fn to_integrate_result(
    path: &Path,
    kind: &str,
    result: ConflictAware,
) -> AppResult<IntegrateResult> {
    let state = detect_state(path)?;
    if result.had_conflicts || !state.conflicts.is_empty() {
        return Ok(IntegrateResult {
            success: false,
            message: format!(
                "{} pausado: {} arquivo(s) em conflito.",
                kind_label(kind),
                state.conflicts.len()
            ),
            state,
        });
    }
    if !result.ok {
        return Err(AppError::Message(if result.stderr.is_empty() {
            format!("{kind} falhou")
        } else {
            redact_secrets(&result.stderr)
        }));
    }
    Ok(IntegrateResult {
        success: true,
        message: format!("{} concluído.", kind_label(kind)),
        state,
    })
}

fn kind_label(kind: &str) -> &'static str {
    match kind {
        "merge" => "Merge",
        "rebase" => "Rebase",
        "cherry-pick" => "Cherry-pick",
        _ => "Operação",
    }
}

struct ConflictAware {
    ok: bool,
    had_conflicts: bool,
    stderr: String,
}

fn run_git_allow_conflict(args: &[&str], cwd: Option<&Path>) -> AppResult<ConflictAware> {
    let mut cmd = Command::new("git");
    crate::process_util::hide_console(&mut cmd);
    cmd.args(args);
    if let Some(dir) = cwd {
        cmd.current_dir(dir);
    }
    allow_conflict_output(cmd)
}

fn allow_conflict_output(mut cmd: Command) -> AppResult<ConflictAware> {
    let output = cmd.output().map_err(|err| {
        if err.kind() == std::io::ErrorKind::NotFound {
            AppError::Message(
                "Git não encontrado. Instale o Git for Windows e reinicie o Gitorade.".into(),
            )
        } else {
            AppError::Io(err)
        }
    })?;

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let stdout = String::from_utf8_lossy(&output.stdout).to_lowercase();
    let stderr_l = stderr.to_lowercase();
    let combined = format!("{stdout}\n{stderr_l}");

    let had_conflicts = combined.contains("conflict")
        || combined.contains("fix conflicts")
        || combined.contains("could not apply")
        || combined.contains("needs merge");

    Ok(ConflictAware {
        ok: output.status.success(),
        had_conflicts,
        stderr,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn kind_labels() {
        assert_eq!(kind_label("merge"), "Merge");
        assert_eq!(kind_label("rebase"), "Rebase");
    }
}
