//! Integration tests exercising the Git adapter against real temporary repos.
//! These never touch the project's own repository.

use std::path::{Path, PathBuf};
use std::process::Command;

use gitorade_lib::git;

fn git_ok(dir: &Path, args: &[&str]) {
    let status = Command::new("git")
        .args(args)
        .current_dir(dir)
        .status()
        .expect("failed to spawn git");
    assert!(status.success(), "git {:?} failed", args);
}

fn init_repo() -> (tempfile::TempDir, PathBuf) {
    let tmp = tempfile::tempdir().expect("tempdir");
    let path = tmp.path().to_path_buf();
    git_ok(&path, &["init", "-b", "main"]);
    // Local identity so plain `git` calls in tests work; the app sets its own
    // identity via env on commit, but branch/stash ops rely on repo config.
    git_ok(&path, &["config", "user.name", "Test User"]);
    git_ok(&path, &["config", "user.email", "test@example.com"]);
    (tmp, path)
}

fn write_file(path: &Path, name: &str, contents: &str) {
    std::fs::write(path.join(name), contents).expect("write file");
}

#[test]
fn detects_git_available() {
    let prereq = git::detect_git();
    assert!(prereq.available, "git should be available in CI/dev env");
}

#[test]
fn status_reports_untracked_then_staged() {
    let (_tmp, path) = init_repo();
    write_file(&path, "a.txt", "hello\n");

    let status = git::status(&path).expect("status");
    assert!(
        status.unstaged.iter().any(|f| f.path == "a.txt"),
        "new file should be unstaged/untracked"
    );

    git::stage(&path, &["a.txt".to_string()]).expect("stage");
    let status = git::status(&path).expect("status");
    assert!(
        status.staged.iter().any(|f| f.path == "a.txt"),
        "file should be staged after add"
    );

    git::unstage(&path, &["a.txt".to_string()]).expect("unstage");
    let status = git::status(&path).expect("status");
    assert!(status.staged.is_empty(), "unstage should clear staged");
}

#[test]
fn commit_uses_provided_identity_without_touching_global() {
    let (_tmp, path) = init_repo();
    write_file(&path, "file.txt", "content\n");
    git::stage(&path, &["file.txt".to_string()]).expect("stage");

    let result = git::commit(&path, "feat: first commit", "Alice Dev", "alice@dev.io")
        .expect("commit");
    assert_eq!(result.author_name, "Alice Dev");
    assert!(!result.hash.is_empty());

    // Verify the commit recorded the provided author, not repo/global config.
    let author = Command::new("git")
        .args(["log", "-1", "--pretty=format:%an <%ae>"])
        .current_dir(&path)
        .output()
        .expect("git log");
    let author = String::from_utf8_lossy(&author.stdout).to_string();
    assert!(author.contains("Alice Dev"), "author was {author}");
    assert!(author.contains("alice@dev.io"));
}

#[test]
fn commit_requires_staged_changes() {
    let (_tmp, path) = init_repo();
    let err = git::commit(&path, "empty", "A", "a@b.c").unwrap_err();
    assert!(err.to_string().to_lowercase().contains("staged"));
}

#[test]
fn branch_lifecycle_and_graph() {
    let (_tmp, path) = init_repo();
    write_file(&path, "f.txt", "one\n");
    git::stage(&path, &["f.txt".to_string()]).expect("stage");
    git::commit(&path, "init", "A", "a@b.c").expect("commit");

    git::create_branch(&path, "feature", true).expect("create+checkout");
    let branches = git::list_branches(&path).expect("branches");
    assert!(branches.iter().any(|b| b.name == "feature" && b.is_current));

    git::checkout_branch(&path, "main").expect("checkout main");
    git::rename_branch(&path, "feature", "feature-2").expect("rename");
    let branches = git::list_branches(&path).expect("branches");
    assert!(branches.iter().any(|b| b.name == "feature-2"));
    assert!(!branches.iter().any(|b| b.name == "feature"));

    git::delete_branch(&path, "feature-2", true).expect("delete");
    let branches = git::list_branches(&path).expect("branches");
    assert!(!branches.iter().any(|b| b.name == "feature-2"));

    let graph = git::commit_graph(&path, 50).expect("graph");
    assert_eq!(graph.commits.len(), 1);
    assert_eq!(graph.commits[0].subject, "init");
}

#[test]
fn stash_roundtrip() {
    let (_tmp, path) = init_repo();
    write_file(&path, "base.txt", "base\n");
    git::stage(&path, &["base.txt".to_string()]).expect("stage");
    git::commit(&path, "base", "A", "a@b.c").expect("commit");

    // Create a change and stash it.
    write_file(&path, "base.txt", "changed\n");
    git::create_stash(&path, Some("wip"), false).expect("stash push");
    let stashes = git::list_stash(&path).expect("stash list");
    assert_eq!(stashes.len(), 1);
    assert!(stashes[0].message.contains("wip"));

    // Working tree should be clean after stash.
    let status = git::status(&path).expect("status");
    assert!(status.unstaged.is_empty() && status.staged.is_empty());

    git::apply_stash(&path, &stashes[0].selector, true).expect("stash pop");
    let status = git::status(&path).expect("status");
    assert!(
        status.unstaged.iter().any(|f| f.path == "base.txt"),
        "changes should return after pop"
    );
}

#[test]
fn handles_paths_with_spaces_and_unicode() {
    let (_tmp, path) = init_repo();
    write_file(&path, "arquivo com espaço e ção.txt", "conteúdo\n");
    git::stage(&path, &["arquivo com espaço e ção.txt".to_string()]).expect("stage");
    let status = git::status(&path).expect("status");
    assert!(
        status.staged.iter().any(|f| f.path.contains("espaço")),
        "unicode/space path should be staged: {:?}",
        status.staged
    );
}
