//! Containment helpers for repo-relative paths from the WebView/IPC.

use std::path::{Component, Path, PathBuf};

use crate::error::{AppError, AppResult};

/// Reject empty, absolute, UNC, drive-letter, `..`, and control characters.
pub fn assert_repo_relative(rel: &str) -> AppResult<&str> {
    let rel = rel.trim();
    if rel.is_empty() {
        return Err(AppError::Message("Caminho vazio.".into()));
    }
    if rel.contains('\0') || rel.chars().any(|c| c.is_control()) {
        return Err(AppError::Message("Caminho de arquivo inválido.".into()));
    }
    if rel.starts_with('/') || rel.starts_with('\\') {
        return Err(AppError::Message("Caminho de arquivo inválido.".into()));
    }
    // Windows drive / UNC-style
    let bytes = rel.as_bytes();
    if bytes.len() >= 2 && bytes[1] == b':' && bytes[0].is_ascii_alphabetic() {
        return Err(AppError::Message("Caminho de arquivo inválido.".into()));
    }
    if rel.starts_with(r"\\") || rel.starts_with("//") {
        return Err(AppError::Message("Caminho de arquivo inválido.".into()));
    }

    let path = Path::new(rel);
    if path.is_absolute() {
        return Err(AppError::Message("Caminho de arquivo inválido.".into()));
    }
    for comp in path.components() {
        match comp {
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return Err(AppError::Message("Caminho de arquivo inválido.".into()));
            }
            Component::CurDir | Component::Normal(_) => {}
        }
    }
    Ok(rel)
}

/// Join `rel` under `repo` after validation. Rejects symlink escapes when the target exists.
pub fn resolve_under_repo(repo: &Path, rel: &str) -> AppResult<PathBuf> {
    let rel = assert_repo_relative(rel)?;
    let repo_canon = std::fs::canonicalize(repo).map_err(|err| {
        AppError::Message(format!(
            "Não foi possível resolver o diretório do repositório: {err}"
        ))
    })?;

    let candidate = repo_canon.join(rel);
    if !candidate.starts_with(&repo_canon) {
        return Err(AppError::Message(
            "Caminho fora do repositório.".into(),
        ));
    }

    if candidate.exists() {
        let canon = std::fs::canonicalize(&candidate).map_err(AppError::Io)?;
        if !canon.starts_with(&repo_canon) {
            return Err(AppError::Message(
                "Caminho fora do repositório.".into(),
            ));
        }
        return Ok(canon);
    }

    Ok(candidate)
}

/// Reject git option-like arguments (leading `-`).
pub fn reject_option_like(arg: &str) -> AppResult<&str> {
    let arg = arg.trim();
    if arg.is_empty() {
        return Err(AppError::Message("Argumento vazio.".into()));
    }
    if arg.starts_with('-') {
        return Err(AppError::Message(
            "Argumento inválido (não pode começar com '-').".into(),
        ));
    }
    Ok(arg)
}

/// Allowlist remote/clone URLs. Blocks `file://`, `ext::`, and option-like strings.
pub fn validate_remote_url(url: &str) -> AppResult<&str> {
    let url = reject_option_like(url)?;
    let lower = url.to_ascii_lowercase();
    if lower.starts_with("file:") || lower.starts_with("ext::") {
        return Err(AppError::Message("URL de remote não permitida.".into()));
    }
    let ok = lower.starts_with("https://")
        || lower.starts_with("http://")
        || lower.starts_with("ssh://")
        || lower.starts_with("git://")
        || lower.starts_with("git@");
    if !ok {
        return Err(AppError::Message(
            "URL deve usar https, http, ssh, git:// ou git@host:path.".into(),
        ));
    }
    Ok(url)
}

/// SSH identity file path safe to embed in `GIT_SSH_COMMAND` (no shell metacharacters).
pub fn validate_ssh_key_path(path: &str) -> AppResult<&str> {
    let path = path.trim();
    if path.is_empty() {
        return Err(AppError::Message("Caminho da chave SSH vazio.".into()));
    }
    if path.contains('\0') || path.chars().any(|c| c.is_control()) {
        return Err(AppError::Message("Caminho da chave SSH inválido.".into()));
    }
    for ch in path.chars() {
        let allowed = ch.is_ascii_alphanumeric()
            || matches!(ch, '/' | '\\' | '.' | '_' | '-' | ' ' | '~')
            || (ch == ':' && cfg!(windows));
        if !allowed {
            return Err(AppError::Message(
                "Caminho da chave SSH contém caracteres não permitidos.".into(),
            ));
        }
    }
    if path.contains('"')
        || path.contains('`')
        || path.contains('$')
        || path.contains(';')
        || path.contains('|')
        || path.contains('&')
        || path.contains('<')
        || path.contains('>')
        || path.contains('\n')
    {
        return Err(AppError::Message(
            "Caminho da chave SSH contém caracteres não permitidos.".into(),
        ));
    }
    Ok(path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn rejects_traversal_and_absolutes() {
        assert!(assert_repo_relative("../secret").is_err());
        assert!(assert_repo_relative("foo/../../x").is_err());
        assert!(assert_repo_relative("/etc/passwd").is_err());
        assert!(assert_repo_relative(r"\Windows\system32").is_err());
        assert!(assert_repo_relative(r"C:\secret").is_err());
        assert!(assert_repo_relative(r"C:secret").is_err());
        assert!(assert_repo_relative(r"\\server\share").is_err());
        assert!(assert_repo_relative("ok/file.ts").is_ok());
        assert!(assert_repo_relative(r"src\main.rs").is_ok());
    }

    #[test]
    fn resolve_under_repo_ok_and_blocks_absolute_rel() {
        let tmp = tempfile::tempdir().unwrap();
        let repo = tmp.path();
        fs::write(repo.join("a.txt"), "x").unwrap();
        let full = resolve_under_repo(repo, "a.txt").unwrap();
        assert!(full.ends_with("a.txt"));
        assert!(resolve_under_repo(repo, r"C:\Windows\win.ini").is_err());
        assert!(resolve_under_repo(repo, "../outside").is_err());
    }

    #[test]
    fn reject_option_like_and_urls() {
        assert!(reject_option_like("--config=core.sshCommand=x").is_err());
        assert!(reject_option_like("main").is_ok());
        assert!(validate_remote_url("https://github.com/a/b.git").is_ok());
        assert!(validate_remote_url("git@github.com:a/b.git").is_ok());
        assert!(validate_remote_url("file:///tmp/x").is_err());
        assert!(validate_remote_url("--config=foo").is_err());
        assert!(validate_remote_url("ext::ssh -o foo").is_err());
    }

    #[test]
    fn ssh_key_path_rejects_metacharacters() {
        assert!(validate_ssh_key_path(r"C:\Users\me\.ssh\id_ed25519").is_ok());
        assert!(validate_ssh_key_path(r#"C:\Users\me\evil"; calc"#).is_err());
        assert!(validate_ssh_key_path("/home/me/.ssh/id_rsa;id").is_err());
        assert!(validate_ssh_key_path("/tmp/key$(reboot)").is_err());
    }
}
