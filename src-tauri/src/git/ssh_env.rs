//! Ensure Git/SSH spawned from the GUI finds the user's `~/.ssh` keys
//! and can ask for the key passphrase (like the terminal / other Git GUIs).
//!
//! On Windows, GUI processes often have empty `HOME`, and OpenSSH has no TTY —
//! without AskPass + without BatchMode the passphrase prompt never appears.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{Once, OnceLock};

/// Apply env vars so remote Git (fetch/pull/push/clone) can authenticate via SSH.
/// Call only for remote operations — never from local `git log` / `status` / etc.
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

    // Prefer Windows OpenSSH; do NOT use BatchMode — key passphrase must be allowed.
    let ssh = resolve_ssh_binary();
    let mut ssh_cmd = format!("\"{ssh}\"");
    ssh_cmd.push_str(" -o StrictHostKeyChecking=accept-new");

    let key = identity_file
        .filter(|p| p.is_file())
        .map(Path::to_path_buf)
        .or_else(discover_default_ssh_key);

    if let Some(key) = key {
        let key_s = key.to_string_lossy();
        ssh_cmd.push_str(&format!(" -i \"{key_s}\" -o IdentitiesOnly=yes"));
    }

    cmd.env("GIT_SSH_COMMAND", ssh_cmd);

    // GUI has no TTY — force AskPass so Windows can show a passphrase dialog.
    if let Some(askpass) = ensure_askpass_helper_cached() {
        cmd.env("SSH_ASKPASS", askpass);
        cmd.env("SSH_ASKPASS_REQUIRE", "force");
        // Some OpenSSH builds still check DISPLAY before using askpass.
        cmd.env("DISPLAY", "localhost:0");
    }

    try_start_windows_ssh_agent_once();
}

fn ensure_askpass_helper_cached() -> Option<&'static PathBuf> {
    static ASKPASS: OnceLock<Option<PathBuf>> = OnceLock::new();
    ASKPASS
        .get_or_init(ensure_askpass_helper)
        .as_ref()
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

/// Writes a small AskPass helper that shows a Windows password dialog.
fn ensure_askpass_helper() -> Option<PathBuf> {
    let dir = dirs::data_local_dir()?.join("gitorade");
    fs::create_dir_all(&dir).ok()?;

    let ps1 = dir.join("ssh-askpass.ps1");
    let cmd = dir.join("ssh-askpass.cmd");

    let ps1_body = r#"param([Parameter(ValueFromRemainingArguments=$true)][string[]]$PromptParts)
$Prompt = if ($PromptParts) { $PromptParts -join ' ' } else { 'Enter passphrase for SSH key' }
Add-Type -AssemblyName System.Windows.Forms | Out-Null
Add-Type -AssemblyName System.Drawing | Out-Null
$form = New-Object System.Windows.Forms.Form
$form.Text = 'Gitorade — SSH'
$form.Size = New-Object System.Drawing.Size(420, 160)
$form.StartPosition = 'CenterScreen'
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false
$form.MinimizeBox = $false
$form.TopMost = $true
$label = New-Object System.Windows.Forms.Label
$label.Left = 12
$label.Top = 12
$label.Width = 380
$label.Height = 36
$label.Text = $Prompt
$form.Controls.Add($label)
$box = New-Object System.Windows.Forms.TextBox
$box.Left = 12
$box.Top = 52
$box.Width = 380
$box.UseSystemPasswordChar = $true
$form.Controls.Add($box)
$ok = New-Object System.Windows.Forms.Button
$ok.Text = 'OK'
$ok.Left = 216
$ok.Top = 86
$ok.DialogResult = [System.Windows.Forms.DialogResult]::OK
$form.AcceptButton = $ok
$form.Controls.Add($ok)
$cancel = New-Object System.Windows.Forms.Button
$cancel.Text = 'Cancelar'
$cancel.Left = 312
$cancel.Top = 86
$cancel.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
$form.CancelButton = $cancel
$form.Controls.Add($cancel)
$result = $form.ShowDialog()
if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
  [Console]::Out.Write($box.Text)
}
"#;

    let cmd_body = format!(
        "@echo off\r\npowershell -NoProfile -ExecutionPolicy Bypass -File \"%~dp0ssh-askpass.ps1\" %*\r\n"
    );

    fs::write(&ps1, ps1_body).ok()?;
    fs::write(&cmd, cmd_body).ok()?;
    Some(cmd)
}

fn try_start_windows_ssh_agent_once() {
    static START: Once = Once::new();
    START.call_once(|| {
        #[cfg(windows)]
        {
            // Best-effort once per process: if the service can start, later ssh-add / agent use works.
            let _ = Command::new("powershell")
                .args([
                    "-NoProfile",
                    "-ExecutionPolicy",
                    "Bypass",
                    "-Command",
                    "try { $s = Get-Service ssh-agent -ErrorAction Stop; if ($s.StartType -eq 'Disabled') { Set-Service ssh-agent -StartupType Manual -ErrorAction SilentlyContinue }; if ($s.Status -ne 'Running') { Start-Service ssh-agent -ErrorAction SilentlyContinue } } catch {}",
                ])
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null())
                .status();
        }
    });
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
    }

    msg.push_str(
        "A chave SSH parece protegida por senha. No push, o Gitorade deve abrir \
         um diálogo pedindo a passphrase — se não apareceu, carregue a chave no agent:\n\n\
         Get-Service ssh-agent | Set-Service -StartupType Manual\n\
         Start-Service ssh-agent\n\
         ssh-add $env:USERPROFILE\\.ssh\\id_rsa\n",
    );
    msg
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn enhance_detects_pubkey_errors() {
        let out = enhance_ssh_error("Permission denied (publickey).\nfatal: Could not read");
        assert!(out.contains("passphrase") || out.contains("ssh-add") || out.contains("Chave"));
    }

    #[test]
    fn askpass_helper_writes() {
        let path = ensure_askpass_helper();
        assert!(path.is_some());
        assert!(path.unwrap().is_file());
    }
}
