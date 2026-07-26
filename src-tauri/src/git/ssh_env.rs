//! Ensure Git/SSH spawned from the GUI finds the user's `~/.ssh` keys.
//!
//! On Windows, GUI processes often have empty `HOME`. Git-for-Windows then
//! launches its MSYS `ssh.exe`, which fails to locate `C:\Users\…\.ssh`.
//! We force `HOME`/`USERPROFILE` and prefer Windows OpenSSH + an identity file.

use std::path::{Path, PathBuf};
use std::process::Command;

/// Apply env vars so remote Git (fetch/pull/push/clone) can authenticate via SSH.
pub fn apply_git_remote_env(cmd: &mut Command, identity_file: Option<&Path>) {
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

    let key = identity_file
        .filter(|p| p.is_file())
        .map(Path::to_path_buf)
        .or_else(discover_default_ssh_key);

    let ssh = resolve_ssh_binary();
    let mut ssh_cmd = format!("\"{ssh}\"");
    ssh_cmd.push_str(" -o BatchMode=yes -o StrictHostKeyChecking=accept-new");

    if let Some(key) = key {
        let key_s = key.to_string_lossy();
        ssh_cmd.push_str(&format!(" -i \"{key_s}\" -o IdentitiesOnly=yes"));
    }

    cmd.env("GIT_SSH_COMMAND", ssh_cmd);
}

pub fn discover_default_ssh_key() -> Option<PathBuf> {
    let ssh_dir = dirs::home_dir()?.join(".ssh");
    for name in ["id_ed25519", "id_ecdsa", "id_rsa"] {
        let path = ssh_dir.join(name);
        if path.is_file() {
            return Some(path);
        }
    }
    None
}

fn resolve_ssh_binary() -> String {
    #[cfg(windows)]
    {
        let win = PathBuf::from(r"C:\Windows\System32\OpenSSH\ssh.exe");
        if win.is_file() {
            return win.to_string_lossy().to_string();
        }
    }
    "ssh".to_string()
}

/// Friendlier message when SSH auth fails.
pub fn enhance_ssh_error(raw: &str) -> String {
    let lower = raw.to_lowercase();
    let is_pubkey = lower.contains("permission denied (publickey)")
        || lower.contains("publickey")
        || (lower.contains("could not read from remote repository")
            && lower.contains("access rights"));

    if !is_pubkey {
        return raw.to_string();
    }

    let mut msg = String::from(raw.trim());
    msg.push_str("\n\n");

    if let Some(key) = discover_default_ssh_key() {
        msg.push_str(&format!(
            "Chave encontrada: {}\n",
            key.to_string_lossy()
        ));
        msg.push_str(
            "Confirme que a chave pública correspondente está em GitHub/GitLab (SSH keys).\n",
        );
    } else if let Some(home) = dirs::home_dir() {
        msg.push_str(&format!(
            "Nenhuma chave em {}\\.ssh (id_ed25519 / id_rsa).\n",
            home.to_string_lossy()
        ));
        msg.push_str("Gere uma com: ssh-keygen -t ed25519 -C \"seu@email\"\n");
    }

    msg.push_str(
        "Se a chave tem senha, inicie o ssh-agent e carregue a chave:\n\
         Get-Service ssh-agent | Set-Service -StartupType Manual; Start-Service ssh-agent\n\
         ssh-add $env:USERPROFILE\\.ssh\\id_rsa\n",
    );
    msg.push_str(
        "Ou associe o caminho da chave privada ao perfil em Credenciais → SSH Keys.",
    );
    msg
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn enhance_detects_pubkey_errors() {
        let out = enhance_ssh_error("Permission denied (publickey).\nfatal: Could not read");
        assert!(out.contains("ssh-add") || out.contains("Chave") || out.contains("Nenhuma chave"));
    }
}
