use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::process::Command;

use crate::domain::{CommitResult, FileChange, GitPrerequisite, RemoteInfo, RepoStatus};
use crate::error::{AppError, AppResult};

pub mod branches;
pub mod history;
pub mod integrate;
pub mod ssh_env;
pub mod stash;

pub use branches::{
    checkout_branch, checkout_branch_force, create_branch, delete_branch, list_branches,
    rename_branch, upstream_status,
};
pub use history::{commit_file_diff, commit_files, commit_graph, file_at_commit, search_commits};
pub use integrate::{
    abort_integrate, cherry_pick, continue_integrate, detect_state as detect_integrate_state,
    list_conflicts, merge_branch, read_conflict_sides, read_file as read_worktree_file, rebase_onto,
    resolve_conflict,
};
pub use ssh_env::{apply_git_remote_env, discover_default_ssh_key, enhance_ssh_error};
pub use stash::{apply_stash, create_stash, drop_stash, list_stash};

/// Runs git with explicit args (never through a shell).
/// Local-only: do not attach SSH/askpass/agent env (that is only for remote ops via `ops::run_streaming`).
pub fn run_git(args: &[&str], cwd: Option<&Path>) -> AppResult<String> {
    let mut cmd = Command::new("git");
    crate::process_util::hide_console(&mut cmd);
    apply_local_git_env(&mut cmd);
    cmd.args(args);
    if let Some(dir) = cwd {
        cmd.current_dir(dir);
    }

    let output = cmd.output().map_err(|err| {
        if err.kind() == std::io::ErrorKind::NotFound {
            AppError::Message(
                "Git não encontrado. Instale o Git for Windows e reinicie o Gitorade.".into(),
            )
        } else {
            AppError::Io(err)
        }
    })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(AppError::Message(if stderr.is_empty() {
            format!("git {} falhou", args.join(" "))
        } else {
            enhance_ssh_error(&redact_secrets(&stderr))
        }));
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim_end_matches('\0').trim().to_string())
}

fn run_git_raw(args: &[&str], cwd: Option<&Path>) -> AppResult<Vec<u8>> {
    let mut cmd = Command::new("git");
    crate::process_util::hide_console(&mut cmd);
    apply_local_git_env(&mut cmd);
    cmd.args(args);
    if let Some(dir) = cwd {
        cmd.current_dir(dir);
    }

    let output = cmd.output().map_err(|err| {
        if err.kind() == std::io::ErrorKind::NotFound {
            AppError::Message(
                "Git não encontrado. Instale o Git for Windows e reinicie o Gitorade.".into(),
            )
        } else {
            AppError::Io(err)
        }
    })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(AppError::Message(if stderr.is_empty() {
            format!("git {} falhou", args.join(" "))
        } else {
            enhance_ssh_error(&redact_secrets(&stderr))
        }));
    }

    Ok(output.stdout)
}

/// Cheap env for local git (config/identity). No SSH agent / AskPass.
fn apply_local_git_env(cmd: &mut Command) {
    if let Some(home) = dirs::home_dir() {
        cmd.env("HOME", &home);
        cmd.env("USERPROFILE", &home);
        #[cfg(windows)]
        {
            let s = home.to_string_lossy();
            if s.len() >= 2 && s.as_bytes().get(1) == Some(&b':') {
                cmd.env("HOMEDRIVE", &s[..2]);
                cmd.env("HOMEPATH", &s[2..]);
            }
        }
    }
}

pub fn detect_git() -> GitPrerequisite {
    match run_git(&["--version"], None) {
        Ok(version) => GitPrerequisite {
            available: true,
            version: Some(version),
            path: which_git(),
            message: "Git disponível.".into(),
        },
        Err(err) => GitPrerequisite {
            available: false,
            version: None,
            path: None,
            message: err.to_string(),
        },
    }
}

pub fn validate_repository(path: &Path) -> AppResult<()> {
    if !path.exists() {
        return Err(AppError::Message("Caminho não existe.".into()));
    }
    if !path.is_dir() {
        return Err(AppError::Message("Caminho não é um diretório.".into()));
    }

    let inside = run_git(&["rev-parse", "--is-inside-work-tree"], Some(path))?;
    if inside != "true" {
        return Err(AppError::Message(
            "O diretório selecionado não é um repositório Git.".into(),
        ));
    }
    Ok(())
}

pub fn current_branch(path: &Path) -> AppResult<Option<String>> {
    let branch = run_git(&["branch", "--show-current"], Some(path))?;
    Ok(if branch.is_empty() {
        None
    } else {
        Some(branch)
    })
}

pub fn repo_name_from_path(path: &Path) -> String {
    path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("repository")
        .to_string()
}

pub fn status(path: &Path) -> AppResult<RepoStatus> {
    let branch = current_branch(path)?;
    // Default untracked (not `all`) — avoids walking huge untracked trees on open.
    let raw = run_git_raw(&["status", "--porcelain=v2", "-z"], Some(path))?;
    let entries = parse_status_porcelain_v2(&raw);

    let mut staged = Vec::new();
    let mut unstaged = Vec::new();

    for entry in entries {
        if entry.staged {
            staged.push(FileChange {
                path: entry.path.clone(),
                status: entry.staged_status.clone().unwrap_or_else(|| entry.status.clone()),
                staged: true,
            });
        }
        if entry.unstaged {
            unstaged.push(FileChange {
                path: entry.path,
                status: entry.unstaged_status.unwrap_or(entry.status),
                staged: false,
            });
        }
    }

    let upstream = branches::upstream_status_for_branch(path, branch.clone()).unwrap_or(
        crate::domain::UpstreamStatus {
            branch: branch.clone(),
            upstream: None,
            ahead: 0,
            behind: 0,
        },
    );

    let integrate = integrate::detect_state(path).unwrap_or(crate::domain::IntegrateState {
        kind: None,
        conflicts: Vec::new(),
    });

    Ok(RepoStatus {
        branch,
        staged,
        unstaged,
        upstream: upstream.upstream,
        ahead: upstream.ahead,
        behind: upstream.behind,
        in_progress: integrate.kind,
        conflicts: integrate.conflicts,
    })
}

pub fn stage(path: &Path, paths: &[String]) -> AppResult<()> {
    if paths.is_empty() {
        return Err(AppError::Message("Nenhum arquivo para stage.".into()));
    }
    let mut args = vec!["add", "--"];
    let refs: Vec<&str> = paths.iter().map(String::as_str).collect();
    args.extend(refs);
    run_git(&args, Some(path))?;
    Ok(())
}

pub fn unstage(path: &Path, paths: &[String]) -> AppResult<()> {
    if paths.is_empty() {
        return Err(AppError::Message("Nenhum arquivo para unstage.".into()));
    }
    let refs: Vec<&str> = paths.iter().map(String::as_str).collect();

    // `git restore --staged` needs a resolvable HEAD. Before the first commit
    // (unborn branch) every staged entry is new, so removing it from the index
    // with `git rm --cached` is the correct way to unstage.
    let mut args: Vec<&str> = if has_head(path) {
        vec!["restore", "--staged", "--"]
    } else {
        vec!["rm", "--cached", "--quiet", "--"]
    };
    args.extend(refs);
    run_git(&args, Some(path))?;
    Ok(())
}

/// Returns true when the repository has at least one commit (resolvable HEAD).
fn has_head(path: &Path) -> bool {
    run_git(&["rev-parse", "--verify", "--quiet", "HEAD"], Some(path)).is_ok()
}

pub fn diff(path: &Path, file_path: &str, staged: bool) -> AppResult<String> {
    let mut args = vec!["diff", "--no-color"];
    if staged {
        args.push("--cached");
    }
    args.push("--");
    args.push(file_path);
    run_git(&args, Some(path))
}

pub fn commit(
    path: &Path,
    message: &str,
    author_name: &str,
    author_email: &str,
) -> AppResult<CommitResult> {
    let message = message.trim();
    if message.is_empty() {
        return Err(AppError::Message("Mensagem de commit vazia.".into()));
    }
    if author_name.trim().is_empty() || author_email.trim().is_empty() {
        return Err(AppError::Message(
            "Selecione um perfil (nome/email) antes de commitar.".into(),
        ));
    }

    let status = status(path)?;
    if status.staged.is_empty() {
        return Err(AppError::Message(
            "Nenhum arquivo staged. Faça stage antes do commit.".into(),
        ));
    }

    let mut cmd = Command::new("git");
    crate::process_util::hide_console(&mut cmd);
    cmd.current_dir(path)
        .env("GIT_AUTHOR_NAME", author_name)
        .env("GIT_AUTHOR_EMAIL", author_email)
        .env("GIT_COMMITTER_NAME", author_name)
        .env("GIT_COMMITTER_EMAIL", author_email)
        .args(["commit", "-m", message]);

    let output = cmd.output().map_err(AppError::Io)?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(AppError::Message(redact_secrets(&stderr)));
    }

    let hash = run_git(&["rev-parse", "--short", "HEAD"], Some(path))?;
    Ok(CommitResult {
        hash,
        message: message.to_string(),
        author_name: author_name.to_string(),
        author_email: author_email.to_string(),
    })
}

fn which_git() -> Option<String> {
    #[cfg(windows)]
    {
        let mut cmd = Command::new("where.exe");
        crate::process_util::hide_console(&mut cmd);
        cmd.arg("git").output().ok().and_then(|out| {
            if !out.status.success() {
                return None;
            }
            String::from_utf8_lossy(&out.stdout)
                .lines()
                .next()
                .map(|line| line.trim().to_string())
        })
    }
    #[cfg(not(windows))]
    {
        Command::new("which")
            .arg("git")
            .output()
            .ok()
            .and_then(|out| {
                if !out.status.success() {
                    return None;
                }
                Some(String::from_utf8_lossy(&out.stdout).trim().to_string())
            })
    }
}

pub fn redact_secrets(input: &str) -> String {
    let mut out = input.to_string();
    for pattern in [
        "ghp_",
        "gho_",
        "ghu_",
        "ghs_",
        "ghr_",
        "glpat-",
        "x-access-token:",
    ] {
        if let Some(idx) = out.find(pattern) {
            let end = (idx + pattern.len() + 24).min(out.len());
            out.replace_range(idx..end, &format!("{pattern}***"));
        }
    }
    out
}

#[derive(Debug, Default)]
struct ParsedEntry {
    path: String,
    status: String,
    staged: bool,
    unstaged: bool,
    staged_status: Option<String>,
    unstaged_status: Option<String>,
}

fn parse_status_porcelain_v2(raw: &[u8]) -> Vec<ParsedEntry> {
    let text = String::from_utf8_lossy(raw);
    let mut by_path: BTreeMap<String, ParsedEntry> = BTreeMap::new();

    for record in text.split('\0') {
        let record = record.trim();
        if record.is_empty() {
            continue;
        }

        let mut parts = record.split(' ');
        let kind = parts.next().unwrap_or("");

        match kind {
            "?" => {
                let path = record.strip_prefix("? ").unwrap_or("").to_string();
                if path.is_empty() {
                    continue;
                }
                by_path.insert(
                    path.clone(),
                    ParsedEntry {
                        path,
                        status: "untracked".into(),
                        staged: false,
                        unstaged: true,
                        staged_status: None,
                        unstaged_status: Some("untracked".into()),
                    },
                );
            }
            "!" => {}
            "1" | "2" | "u" => {
                let xy = parts.next().unwrap_or("..");
                let path = extract_path_from_v2(record, kind);
                if path.is_empty() {
                    continue;
                }

                let x = xy.chars().next().unwrap_or('.');
                let y = xy.chars().nth(1).unwrap_or('.');

                let mut entry = by_path.remove(&path).unwrap_or(ParsedEntry {
                    path: path.clone(),
                    ..Default::default()
                });

                if x != '.' {
                    entry.staged = true;
                    entry.staged_status = Some(status_letter(x));
                    entry.status = status_letter(x);
                }
                if y != '.' {
                    entry.unstaged = true;
                    entry.unstaged_status = Some(status_letter(y));
                    if !entry.staged {
                        entry.status = status_letter(y);
                    }
                }

                by_path.insert(path, entry);
            }
            _ => {}
        }
    }

    by_path.into_values().collect()
}

fn extract_path_from_v2(record: &str, kind: &str) -> String {
    // Ordinary: 1 XY sub mH mI mW hH hI path
    // Rename:   2 XY sub mH mI mW hH hI score X path\0orig
    // Unmerged: u XY sub m1 m2 m3 h1 h2 h3 path
    let parts: Vec<&str> = record.splitn(9, ' ').collect();
    match kind {
        "1" | "u" => {
            if parts.len() >= 9 {
                parts[8].to_string()
            } else {
                record.rsplit(' ').next().unwrap_or("").to_string()
            }
        }
        "2" => {
            // path may contain spaces; after score field comes path
            if let Some(score_idx) = record.find(" R") {
                // fallback: take last token after 9 fields-ish
                let _ = score_idx;
            }
            let fields: Vec<&str> = record.splitn(10, ' ').collect();
            if fields.len() >= 10 {
                fields[9].split('\t').next().unwrap_or("").to_string()
            } else {
                record.rsplit(' ').next().unwrap_or("").to_string()
            }
        }
        _ => String::new(),
    }
}

fn status_letter(c: char) -> String {
    match c {
        'M' => "modified".into(),
        'A' => "added".into(),
        'D' => "deleted".into(),
        'R' => "renamed".into(),
        'C' => "copied".into(),
        'T' => "typechange".into(),
        'U' => "unmerged".into(),
        _ => "modified".into(),
    }
}

pub fn canonicalize_path(path: &str) -> AppResult<PathBuf> {
    let p = PathBuf::from(path);
    p.canonicalize().map_err(|err| {
        AppError::Message(format!("Caminho inválido: {err}"))
    })
}

pub fn init_repository(path: &Path, bare: bool) -> AppResult<PathBuf> {
    std::fs::create_dir_all(path)?;
    let mut args = vec!["init"];
    if bare {
        args.push("--bare");
    }
    run_git(&args, Some(path))?;
    canonicalize_path(&path.to_string_lossy())
}

pub fn list_remotes(path: &Path) -> AppResult<Vec<RemoteInfo>> {
    let raw = run_git(&["remote", "-v"], Some(path))?;
    let mut map: BTreeMap<String, RemoteInfo> = BTreeMap::new();

    for line in raw.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        // format: name\turl (fetch|push)
        let mut tab = line.splitn(2, '\t');
        let name = tab.next().unwrap_or("").trim().to_string();
        let rest = tab.next().unwrap_or("");
        if name.is_empty() || rest.is_empty() {
            continue;
        }
        let (url, kind) = match rest.rsplit_once(' ') {
            Some((u, k)) => (u.trim().to_string(), k.trim_matches(['(', ')']).to_string()),
            None => (rest.trim().to_string(), "fetch".to_string()),
        };

        let entry = map.entry(name.clone()).or_insert(RemoteInfo {
            name: name.clone(),
            fetch_url: None,
            push_url: None,
        });
        if kind == "push" {
            entry.push_url = Some(url);
        } else {
            entry.fetch_url = Some(url);
        }
    }

    Ok(map.into_values().collect())
}

pub fn add_remote(path: &Path, name: &str, url: &str) -> AppResult<()> {
    let name = name.trim();
    let url = url.trim();
    if name.is_empty() || url.is_empty() {
        return Err(AppError::Message("Nome e URL do remote são obrigatórios.".into()));
    }
    run_git(&["remote", "add", name, url], Some(path))?;
    Ok(())
}

pub fn remove_remote(path: &Path, name: &str) -> AppResult<()> {
    run_git(&["remote", "remove", name], Some(path))?;
    Ok(())
}

/// Args builders for streaming operations (executed by the ops module).
pub fn fetch_args(remote: Option<&str>) -> Vec<String> {
    let mut args = vec!["fetch".to_string(), "--progress".to_string(), "--prune".to_string()];
    match remote {
        Some(r) => args.push(r.to_string()),
        None => args.push("--all".to_string()),
    }
    args
}

pub fn pull_args(remote: Option<&str>, branch: Option<&str>) -> Vec<String> {
    let mut args = vec!["pull".to_string(), "--progress".to_string()];
    if let Some(r) = remote {
        args.push(r.to_string());
        if let Some(b) = branch {
            args.push(b.to_string());
        }
    }
    args
}

pub fn push_args(remote: Option<&str>, branch: Option<&str>, set_upstream: bool) -> Vec<String> {
    let mut args = vec!["push".to_string(), "--progress".to_string()];
    if set_upstream {
        args.push("--set-upstream".to_string());
    }
    if let Some(r) = remote {
        args.push(r.to_string());
        if let Some(b) = branch {
            args.push(b.to_string());
        }
    }
    args
}

pub fn clone_args(url: &str, target: &str) -> Vec<String> {
    vec![
        "clone".to_string(),
        "--progress".to_string(),
        url.to_string(),
        target.to_string(),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn redacts_github_pat_prefix() {
        let raw = "fatal: Authentication failed for 'https://ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ1234@github.com/x/y.git'";
        let redacted = redact_secrets(raw);
        assert!(redacted.contains("ghp_***"));
        assert!(!redacted.contains("ABCDEFGHIJKLMNOPQRSTUVWXYZ1234"));
    }

    #[test]
    fn parses_untracked_and_modified() {
        let raw = b"1 MM N... 100644 100644 100644 abc abc src/App.tsx\0? notes.txt\0";
        let entries = parse_status_porcelain_v2(raw);
        assert_eq!(entries.len(), 2);
        let app = entries.iter().find(|e| e.path == "src/App.tsx").unwrap();
        assert!(app.staged && app.unstaged);
        let notes = entries.iter().find(|e| e.path == "notes.txt").unwrap();
        assert!(notes.unstaged && !notes.staged);
    }
}
