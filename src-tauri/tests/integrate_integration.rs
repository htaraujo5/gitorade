//! Extra integration coverage for merge / conflict / cherry-pick / rebase.

use std::path::{Path, PathBuf};
use std::process::Command;

use gitorade_lib::git;

fn git_ok(dir: &Path, args: &[&str]) {
    let status = Command::new("git")
        .args(args)
        .current_dir(dir)
        .status()
        .expect("spawn git");
    assert!(status.success(), "git {:?} failed", args);
}

fn init_repo() -> (tempfile::TempDir, PathBuf) {
    let tmp = tempfile::tempdir().expect("tempdir");
    let path = tmp.path().to_path_buf();
    git_ok(&path, &["init", "-b", "main"]);
    git_ok(&path, &["config", "user.name", "Test User"]);
    git_ok(&path, &["config", "user.email", "test@example.com"]);
    (tmp, path)
}

fn write(path: &Path, name: &str, contents: &str) {
    std::fs::write(path.join(name), contents).expect("write");
}

fn commit_file(path: &Path, name: &str, contents: &str, msg: &str) {
    write(path, name, contents);
    git::stage(path, &[name.to_string()]).expect("stage");
    git::commit(path, msg, "A", "a@b.c").expect("commit");
}

#[test]
fn merge_clean_succeeds() {
    let (_tmp, path) = init_repo();
    commit_file(&path, "f.txt", "base\n", "base");
    git::create_branch(&path, "feature", true).expect("branch");
    commit_file(&path, "f.txt", "feature\n", "feat");
    git::checkout_branch(&path, "main").expect("checkout");
    commit_file(&path, "other.txt", "main only\n", "main");

    let result = git::merge_branch(&path, "feature").expect("merge");
    assert!(result.success, "{}", result.message);
    assert!(result.state.conflicts.is_empty());
}

#[test]
fn merge_conflict_then_resolve_ours_and_continue() {
    let (_tmp, path) = init_repo();
    commit_file(&path, "f.txt", "base\n", "base");
    git::create_branch(&path, "feature", true).expect("branch");
    commit_file(&path, "f.txt", "feature side\n", "feat");
    git::checkout_branch(&path, "main").expect("checkout");
    commit_file(&path, "f.txt", "main side\n", "main");

    let result = git::merge_branch(&path, "feature").expect("merge conflict");
    assert!(!result.success);
    assert!(!result.state.conflicts.is_empty());
    assert_eq!(result.state.kind.as_deref(), Some("merge"));

    let state = git::resolve_conflict(&path, "f.txt", "ours", None).expect("resolve");
    assert!(state.conflicts.is_empty());

    let cont = git::continue_integrate(&path).expect("continue");
    assert!(cont.success, "{}", cont.message);
    let status = git::status(&path).expect("status");
    assert!(status.in_progress.is_none());
}

#[test]
fn cherry_pick_applies_commit() {
    let (_tmp, path) = init_repo();
    commit_file(&path, "a.txt", "one\n", "one");
    git::create_branch(&path, "other", true).expect("branch");
    commit_file(&path, "b.txt", "two\n", "two");
    let graph = git::commit_graph(&path, 10).expect("graph");
    let tip = graph.commits[0].hash.clone();
    git::checkout_branch(&path, "main").expect("checkout");

    let result = git::cherry_pick(&path, &tip).expect("cherry-pick");
    assert!(result.success, "{}", result.message);
    assert!(path.join("b.txt").exists());
}

#[test]
fn rebase_onto_linearizes() {
    let (_tmp, path) = init_repo();
    commit_file(&path, "base.txt", "base\n", "base");
    git::create_branch(&path, "feature", true).expect("branch");
    commit_file(&path, "feat.txt", "feat\n", "feat");
    git::checkout_branch(&path, "main").expect("checkout");
    commit_file(&path, "main.txt", "main\n", "main");
    git::checkout_branch(&path, "feature").expect("back");

    let result = git::rebase_onto(&path, "main").expect("rebase");
    assert!(result.success, "{}", result.message);
    assert!(path.join("main.txt").exists());
    assert!(path.join("feat.txt").exists());
}
