//! Per-file inspection: blame and history (`git blame` / `git log --follow`).

use std::collections::HashMap;
use std::path::Path;

use crate::domain::{BlameLine, FileHistoryEntry};
use crate::error::{AppError, AppResult};
use crate::git::path_guard::{assert_repo_relative, reject_option_like};
use crate::git::{run_git, run_git_raw};

const UNIT_SEP: char = '\u{1f}';
const RECORD_SEP: char = '\u{1e}';

/// Line-by-line blame of `file_path` at `rev` (working tree when `rev` is None).
pub fn file_blame(path: &Path, file_path: &str, rev: Option<&str>) -> AppResult<Vec<BlameLine>> {
    let file_path = assert_repo_relative(file_path)?;
    let mut args: Vec<&str> = vec!["blame", "--porcelain"];
    let rev = match rev.map(str::trim).filter(|r| !r.is_empty()) {
        Some(r) => Some(reject_option_like(r)?),
        None => None,
    };
    if let Some(r) = rev {
        args.push(r);
    }
    args.push("--");
    args.push(file_path);
    let raw = run_git_raw(&args, Some(path))?;
    Ok(parse_blame_porcelain(&String::from_utf8_lossy(&raw)))
}

#[derive(Default, Clone)]
struct CommitMeta {
    author: String,
    author_email: String,
    author_time: i64,
    summary: String,
}

fn parse_blame_porcelain(text: &str) -> Vec<BlameLine> {
    let mut metas: HashMap<String, CommitMeta> = HashMap::new();
    let mut out = Vec::new();
    let mut current_hash = String::new();
    let mut current_line: u32 = 0;

    for line in text.split('\n') {
        if let Some(content) = line.strip_prefix('\t') {
            let meta = metas.get(&current_hash).cloned().unwrap_or_default();
            let uncommitted = current_hash.chars().all(|c| c == '0');
            out.push(BlameLine {
                line: current_line,
                hash: current_hash.clone(),
                short_hash: current_hash.chars().take(7).collect(),
                author_name: if uncommitted {
                    "Não commitado".into()
                } else {
                    meta.author.clone()
                },
                author_email: meta.author_email.clone(),
                authored_at: chrono::DateTime::from_timestamp(meta.author_time, 0)
                    .map(|d| d.to_rfc3339())
                    .unwrap_or_default(),
                summary: meta.summary.clone(),
                content: content.trim_end_matches('\r').to_string(),
            });
            continue;
        }

        let mut parts = line.splitn(2, ' ');
        let key = parts.next().unwrap_or("");
        let rest = parts.next().unwrap_or("");

        if key.len() == 40 && key.chars().all(|c| c.is_ascii_hexdigit()) {
            current_hash = key.to_string();
            let mut nums = rest.split(' ');
            let _orig = nums.next();
            current_line = nums.next().and_then(|n| n.parse().ok()).unwrap_or(0);
            metas.entry(current_hash.clone()).or_default();
            continue;
        }

        if let Some(meta) = metas.get_mut(&current_hash) {
            match key {
                "author" => meta.author = rest.to_string(),
                "author-mail" => {
                    meta.author_email = rest.trim_matches(['<', '>']).to_string();
                }
                "author-time" => meta.author_time = rest.parse().unwrap_or(0),
                "summary" => meta.summary = rest.to_string(),
                _ => {}
            }
        }
    }
    out
}

/// Commits touching `file_path` (follows renames). Each entry carries the path at that commit.
pub fn file_history(path: &Path, file_path: &str, limit: usize) -> AppResult<Vec<FileHistoryEntry>> {
    let file_path = assert_repo_relative(file_path)?;
    let limit = limit.clamp(1, 1000);
    let pretty = format!(
        "{r}%H{u}%h{u}%an{u}%ae{u}%aI{u}%s",
        u = UNIT_SEP,
        r = RECORD_SEP
    );
    let raw = run_git(
        &[
            "log",
            "--follow",
            "--name-status",
            &format!("--max-count={limit}"),
            &format!("--pretty=format:{pretty}"),
            "--",
            file_path,
        ],
        Some(path),
    )
    .map_err(|err| match err {
        AppError::Message(msg) if msg.contains("does not have any commits") => {
            AppError::Message("Repositório ainda sem commits.".into())
        }
        other => other,
    })?;
    Ok(parse_file_history(&raw, file_path))
}

fn parse_file_history(raw: &str, fallback_path: &str) -> Vec<FileHistoryEntry> {
    let mut out = Vec::new();
    for record in raw.split(RECORD_SEP) {
        let record = record.trim_matches(['\n', '\r']);
        if record.is_empty() {
            continue;
        }
        let mut lines = record.lines();
        let header = lines.next().unwrap_or("");
        let parts: Vec<&str> = header.split(UNIT_SEP).collect();
        if parts.len() < 6 {
            continue;
        }
        let mut status = String::from("M");
        let mut file = fallback_path.to_string();
        for l in lines {
            let l = l.trim();
            if l.is_empty() {
                continue;
            }
            let mut cols = l.split('\t');
            status = cols.next().unwrap_or("M").to_string();
            if let Some(last) = cols.next_back() {
                file = last.to_string();
            }
        }
        out.push(FileHistoryEntry {
            hash: parts[0].to_string(),
            short_hash: parts[1].to_string(),
            author_name: parts[2].to_string(),
            author_email: parts[3].to_string(),
            authored_at: parts[4].to_string(),
            subject: parts[5].to_string(),
            path: file,
            status,
        });
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_blame_porcelain_reusing_metadata() {
        let sha = "a".repeat(40);
        let text = format!(
            "{sha} 1 1 2\nauthor Alice\nauthor-mail <alice@x.io>\nauthor-time 1700000000\nsummary init\nfilename f.txt\n\tline one\n{sha} 2 2\n\tline two\n"
        );
        let lines = parse_blame_porcelain(&text);
        assert_eq!(lines.len(), 2);
        assert_eq!(lines[0].line, 1);
        assert_eq!(lines[0].author_name, "Alice");
        assert_eq!(lines[0].author_email, "alice@x.io");
        assert_eq!(lines[1].line, 2);
        assert_eq!(lines[1].summary, "init");
        assert_eq!(lines[1].content, "line two");
    }

    #[test]
    fn parses_file_history_with_renames() {
        let raw = format!(
            "{r}h1{u}s1{u}A{u}a@x{u}2026-01-02T00:00:00Z{u}rename\n\nR100\told.txt\tnew.txt\n{r}h0{u}s0{u}A{u}a@x{u}2026-01-01T00:00:00Z{u}add\n\nA\told.txt\n",
            r = RECORD_SEP,
            u = UNIT_SEP
        );
        let entries = parse_file_history(&raw, "new.txt");
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].path, "new.txt");
        assert!(entries[0].status.starts_with('R'));
        assert_eq!(entries[1].path, "old.txt");
        assert_eq!(entries[1].status, "A");
    }

    #[test]
    fn blame_and_history_on_real_repo() {
        let tmp = tempfile::tempdir().unwrap();
        let repo = tmp.path();
        run_git(&["init", "-q"], Some(repo)).unwrap();
        let commit = |msg: &str| {
            run_git(&["add", "-A"], Some(repo)).unwrap();
            crate::git::commit(repo, msg, "Alice", "alice@x.io").unwrap();
        };
        std::fs::write(repo.join("old.txt"), "a\nb\n").unwrap();
        commit("add");
        run_git(&["mv", "old.txt", "new.txt"], Some(repo)).unwrap();
        commit("rename");
        std::fs::write(repo.join("new.txt"), "a\nb\nc\n").unwrap();

        let history = file_history(repo, "new.txt", 50).unwrap();
        assert_eq!(history.len(), 2);
        assert_eq!(history[1].path, "old.txt");

        let blame = file_blame(repo, "new.txt", None).unwrap();
        assert_eq!(blame.len(), 3);
        assert_eq!(blame[0].author_name, "Alice");
        assert!(blame[2].hash.chars().all(|c| c == '0'), "uncommitted line");

        let at_head = file_blame(repo, "new.txt", Some("HEAD")).unwrap();
        assert_eq!(at_head.len(), 2);
        assert!(file_blame(repo, "../etc/passwd", None).is_err());
    }
}
