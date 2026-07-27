use std::collections::{HashMap, HashSet};
use std::path::Path;

use crate::domain::{CommitFileChange, CommitGraph, CommitSummary, GraphEdge};
use crate::error::AppResult;
use crate::git::path_guard::{assert_repo_relative, reject_option_like};
use crate::git::run_git;

const UNIT_SEP: char = '\u{1f}';
const RECORD_SEP: char = '\u{1e}';

pub fn commit_graph(path: &Path, limit: usize) -> AppResult<CommitGraph> {
    let limit = limit.clamp(1, 500);
    let pretty = format!(
        "%H{u}%P{u}%s{u}%an{u}%ae{u}%aI{u}%D{u}%h{r}",
        u = UNIT_SEP,
        r = RECORD_SEP
    );
    let raw = run_git(
        &[
            "log",
            "--all",
            "--topo-order",
            &format!("--max-count={limit}"),
            &format!("--pretty=format:{pretty}"),
        ],
        Some(path),
    )?;

    let mut commits = Vec::new();
    for record in raw.split(RECORD_SEP) {
        let record = record.trim().trim_matches('\n').trim_matches('\r');
        if record.is_empty() {
            continue;
        }
        let parts: Vec<&str> = record.split(UNIT_SEP).collect();
        if parts.len() < 8 {
            continue;
        }
        let parents = parts[1]
            .split_whitespace()
            .filter(|p| !p.is_empty())
            .map(|p| p.to_string())
            .collect::<Vec<_>>();
        let refs = parts[6]
            .split(',')
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .map(|s| s.trim_start_matches("HEAD -> ").to_string())
            .filter(|s| s != "HEAD")
            .collect::<Vec<_>>();

        commits.push(CommitSummary {
            hash: parts[0].to_string(),
            short_hash: parts[7].to_string(),
            parents,
            subject: parts[2].to_string(),
            author_name: parts[3].to_string(),
            author_email: parts[4].to_string(),
            authored_at: parts[5].to_string(),
            refs,
            lane: 0,
        });
    }

    let (commits, edges) = assign_lanes(commits);
    Ok(CommitGraph { commits, edges })
}

fn assign_lanes(mut commits: Vec<CommitSummary>) -> (Vec<CommitSummary>, Vec<GraphEdge>) {
    // Active lane → hash expected next on that lane (tip → root walk).
    let mut lanes: Vec<Option<String>> = Vec::new();
    let mut edges = Vec::new();

    for commit in &mut commits {
        // Prefer an existing reservation for this hash; else leftmost free / push.
        let lane = if let Some(idx) = lanes.iter().position(|h| h.as_deref() == Some(commit.hash.as_str()))
        {
            idx
        } else if let Some(idx) = lanes.iter().position(|h| h.is_none()) {
            idx
        } else {
            lanes.push(None);
            lanes.len() - 1
        };

        commit.lane = lane;
        // Occupied by this commit until we place parents.
        if lane < lanes.len() {
            lanes[lane] = None;
        } else {
            lanes.resize(lane + 1, None);
        }

        for (idx, parent) in commit.parents.iter().enumerate() {
            let parent_lane = if let Some(existing) = lanes
                .iter()
                .position(|h| h.as_deref() == Some(parent.as_str()))
            {
                // Parent already reserved on another lane (merge into existing).
                existing
            } else if idx == 0 {
                // First parent continues on this lane.
                lanes[lane] = Some(parent.clone());
                lane
            } else if let Some(free) = lanes.iter().position(|h| h.is_none()) {
                lanes[free] = Some(parent.clone());
                free
            } else {
                lanes.push(Some(parent.clone()));
                lanes.len() - 1
            };

            edges.push(GraphEdge {
                from_hash: commit.hash.clone(),
                to_hash: parent.clone(),
                from_lane: lane,
                to_lane: parent_lane,
            });
        }
        // No parents: lane already cleared — available for reuse.
    }

    // Drop trailing empty lanes, then dense-remap used indices.
    while lanes.last().is_some_and(|h| h.is_none()) {
        lanes.pop();
    }

    let used: HashSet<usize> = commits.iter().map(|c| c.lane).collect();
    let mut sorted: Vec<usize> = used.into_iter().collect();
    sorted.sort_unstable();
    let remap: HashMap<usize, usize> = sorted
        .into_iter()
        .enumerate()
        .map(|(new, old)| (old, new))
        .collect();

    for commit in &mut commits {
        commit.lane = *remap.get(&commit.lane).unwrap_or(&0);
    }
    for edge in &mut edges {
        edge.from_lane = *remap.get(&edge.from_lane).unwrap_or(&0);
        edge.to_lane = *remap.get(&edge.to_lane).unwrap_or(&0);
    }

    (commits, edges)
}

pub fn search_commits(path: &Path, query: &str, limit: usize) -> AppResult<Vec<CommitSummary>> {
    let query = query.trim();
    if query.is_empty() {
        return Ok(commit_graph(path, limit)?.commits);
    }
    let graph = commit_graph(path, limit.max(100))?;
    let q = query.to_lowercase();
    Ok(graph
        .commits
        .into_iter()
        .filter(|c| {
            c.subject.to_lowercase().contains(&q)
                || c.author_name.to_lowercase().contains(&q)
                || c.author_email.to_lowercase().contains(&q)
                || c.hash.to_lowercase().starts_with(&q)
                || c.short_hash.to_lowercase().starts_with(&q)
                || c.refs.iter().any(|r| r.to_lowercase().contains(&q))
        })
        .take(limit)
        .collect())
}

/// List files changed in a commit (`git show --name-status --format=`).
pub fn commit_files(path: &Path, hash: &str) -> AppResult<Vec<CommitFileChange>> {
    let hash = hash.trim();
    if hash.is_empty() {
        return Ok(Vec::new());
    }
    let raw = run_git(
        &["show", "--name-status", "--format=", "--no-color", hash],
        Some(path),
    )?;
    let mut files = Vec::new();
    for line in raw.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let mut parts = line.split('\t');
        let status = parts.next().unwrap_or("M").to_string();
        // Renames: R100\told\tnew — keep the new path
        let path = parts.next_back().unwrap_or("").to_string();
        if path.is_empty() {
            continue;
        }
        files.push(CommitFileChange { path, status });
    }
    Ok(files)
}

/// Unified diff for a single file in a commit (`git show hash -- path`).
pub fn commit_file_diff(path: &Path, hash: &str, file_path: &str) -> AppResult<String> {
    let hash = hash.trim();
    if hash.is_empty() {
        return Ok(String::new());
    }
    let hash = reject_option_like(hash)?;
    let file_path = assert_repo_relative(file_path)?;
    run_git(
        &["show", "--no-color", "--format=", hash, "--", file_path],
        Some(path),
    )
}

/// File contents as of a commit (`git show hash:path`). No textconv (avoids filters/hooks).
pub fn file_at_commit(path: &Path, hash: &str, file_path: &str) -> AppResult<String> {
    let hash = hash.trim();
    if hash.is_empty() {
        return Ok(String::new());
    }
    let hash = reject_option_like(hash)?;
    let file_path = assert_repo_relative(file_path)?;
    // `hash:path` — colon form; path must not start with /
    let spec = format!("{hash}:{file_path}");
    run_git(
        &[
            "-c",
            "diff.external=",
            "show",
            "--no-color",
            "--no-textconv",
            &spec,
        ],
        Some(path),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn assign_lanes_linear() {
        let commits = vec![
            CommitSummary {
                hash: "c2".into(),
                short_hash: "c2".into(),
                parents: vec!["c1".into()],
                subject: "two".into(),
                author_name: "a".into(),
                author_email: "a@b.c".into(),
                authored_at: "2026-01-01T00:00:00Z".into(),
                refs: vec!["main".into()],
                lane: 0,
            },
            CommitSummary {
                hash: "c1".into(),
                short_hash: "c1".into(),
                parents: vec![],
                subject: "one".into(),
                author_name: "a".into(),
                author_email: "a@b.c".into(),
                authored_at: "2026-01-01T00:00:00Z".into(),
                refs: vec![],
                lane: 0,
            },
        ];
        let (out, edges) = assign_lanes(commits);
        assert_eq!(out[0].lane, 0);
        assert_eq!(out[1].lane, 0);
        assert_eq!(edges.len(), 1);
    }

    #[test]
    fn assign_lanes_reuses_after_merge() {
        // tip merge → two parents → then parents meet again should stay dense
        let commits = vec![
            CommitSummary {
                hash: "m".into(),
                short_hash: "m".into(),
                parents: vec!["a".into(), "b".into()],
                subject: "merge".into(),
                author_name: "a".into(),
                author_email: "a@b.c".into(),
                authored_at: "2026-01-03T00:00:00Z".into(),
                refs: vec![],
                lane: 0,
            },
            CommitSummary {
                hash: "a".into(),
                short_hash: "a".into(),
                parents: vec!["base".into()],
                subject: "a".into(),
                author_name: "a".into(),
                author_email: "a@b.c".into(),
                authored_at: "2026-01-02T00:00:00Z".into(),
                refs: vec![],
                lane: 0,
            },
            CommitSummary {
                hash: "b".into(),
                short_hash: "b".into(),
                parents: vec!["base".into()],
                subject: "b".into(),
                author_name: "a".into(),
                author_email: "a@b.c".into(),
                authored_at: "2026-01-02T00:00:00Z".into(),
                refs: vec![],
                lane: 0,
            },
            CommitSummary {
                hash: "base".into(),
                short_hash: "base".into(),
                parents: vec![],
                subject: "base".into(),
                author_name: "a".into(),
                author_email: "a@b.c".into(),
                authored_at: "2026-01-01T00:00:00Z".into(),
                refs: vec![],
                lane: 0,
            },
        ];
        let (out, _) = assign_lanes(commits);
        let max = out.iter().map(|c| c.lane).max().unwrap_or(0);
        assert!(max <= 1, "expected at most 2 lanes, got max={max}");
        assert_eq!(out[0].lane, 0);
    }

    #[test]
    fn rejects_path_traversal() {
        assert!(assert_repo_relative("../secret").is_err());
        assert!(assert_repo_relative("ok/file.ts").is_ok());
        assert!(assert_repo_relative(r"C:\Windows\win.ini").is_err());
    }
}
