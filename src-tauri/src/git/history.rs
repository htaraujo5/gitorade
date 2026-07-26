use std::collections::{HashMap, HashSet};
use std::path::Path;

use crate::domain::{CommitFileChange, CommitGraph, CommitSummary, GraphEdge};
use crate::error::AppResult;
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
    let mut hash_to_lane: HashMap<String, usize> = HashMap::new();
    let mut free_lanes: Vec<usize> = Vec::new();
    let mut next_lane = 0usize;
    let mut edges = Vec::new();

    // Process in topo order (parents after children in git log --topo-order? Actually
    // git log --topo-order lists children before parents. We walk from tip to root.
    for commit in &mut commits {
        let lane = if let Some(&existing) = hash_to_lane.get(&commit.hash) {
            existing
        } else if let Some(lane) = free_lanes.pop() {
            hash_to_lane.insert(commit.hash.clone(), lane);
            lane
        } else {
            let lane = next_lane;
            next_lane += 1;
            hash_to_lane.insert(commit.hash.clone(), lane);
            lane
        };
        commit.lane = lane;

        for (idx, parent) in commit.parents.iter().enumerate() {
            let parent_lane = if idx == 0 {
                // First parent continues same lane
                hash_to_lane
                    .entry(parent.clone())
                    .or_insert(lane);
                *hash_to_lane.get(parent).unwrap_or(&lane)
            } else {
                // Merge parents get new/free lanes
                if let Some(&pl) = hash_to_lane.get(parent) {
                    pl
                } else if let Some(pl) = free_lanes.pop() {
                    hash_to_lane.insert(parent.clone(), pl);
                    pl
                } else {
                    let pl = next_lane;
                    next_lane += 1;
                    hash_to_lane.insert(parent.clone(), pl);
                    pl
                }
            };

            edges.push(GraphEdge {
                from_hash: commit.hash.clone(),
                to_hash: parent.clone(),
                from_lane: lane,
                to_lane: if idx == 0 { lane } else { parent_lane },
            });
        }

        // If this commit has no first-parent continuation (leaf of a side branch ending),
        // free the lane when no other refs point into it. Simple heuristic: free lane if
        // commit has zero parents (root) — parent lanes stay allocated until used.
        if commit.parents.is_empty() {
            free_lanes.push(lane);
        }
    }

    // Re-normalize lanes to dense indices for UI
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

fn validate_repo_rel_path(file_path: &str) -> AppResult<&str> {
    let file_path = file_path.trim();
    if file_path.is_empty() {
        return Err(crate::error::AppError::Message("Caminho vazio.".into()));
    }
    if file_path.contains('\0')
        || file_path.starts_with('/')
        || file_path.starts_with('\\')
        || file_path.contains("..")
    {
        return Err(crate::error::AppError::Message(
            "Caminho de arquivo inválido.".into(),
        ));
    }
    Ok(file_path)
}

/// Unified diff for a single file in a commit (`git show hash -- path`).
pub fn commit_file_diff(path: &Path, hash: &str, file_path: &str) -> AppResult<String> {
    let hash = hash.trim();
    let file_path = validate_repo_rel_path(file_path)?;
    if hash.is_empty() {
        return Ok(String::new());
    }
    run_git(
        &["show", "--no-color", "--format=", hash, "--", file_path],
        Some(path),
    )
}

/// File contents as of a commit (`git show hash:path`).
pub fn file_at_commit(path: &Path, hash: &str, file_path: &str) -> AppResult<String> {
    let hash = hash.trim();
    let file_path = validate_repo_rel_path(file_path)?;
    if hash.is_empty() {
        return Ok(String::new());
    }
    // `hash:path` — colon form; path must not start with /
    let spec = format!("{hash}:{file_path}");
    run_git(&["show", "--no-color", "--textconv", &spec], Some(path))
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
    fn rejects_path_traversal() {
        assert!(validate_repo_rel_path("../secret").is_err());
        assert!(validate_repo_rel_path("ok/file.ts").is_ok());
    }
}
