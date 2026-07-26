//! SSH env for remote Git + in-app AskPass bridge (no WinForms dialog).
//!
//! OpenSSH invokes our helper → request file → Rust emits `ssh://askpass` →
//! OperationOverlay collects passphrase → `respond_ssh_askpass` writes response.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, Once, OnceLock};
use std::thread;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};

pub const ASKPASS_EVENT: &str = "ssh://askpass";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AskpassRequest {
    pub request_id: String,
    pub prompt: String,
}

/// Apply env vars so remote Git (fetch/pull/push/clone) can authenticate via SSH.
pub fn apply_git_remote_env(cmd: &mut std::process::Command, identity_file: Option<&Path>) {
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

    if let Some(askpass) = ensure_askpass_helper_cached() {
        cmd.env("SSH_ASKPASS", askpass);
        cmd.env("SSH_ASKPASS_REQUIRE", "force");
        cmd.env("DISPLAY", "localhost:0");
    }

    try_start_windows_ssh_agent_once();
}

fn ensure_askpass_helper_cached() -> Option<&'static PathBuf> {
    static ASKPASS: OnceLock<Option<PathBuf>> = OnceLock::new();
    ASKPASS.get_or_init(ensure_askpass_helper).as_ref()
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

fn askpass_dir() -> Option<PathBuf> {
    let dir = dirs::data_local_dir()?.join("gitorade").join("askpass");
    fs::create_dir_all(&dir).ok()?;
    Some(dir)
}

/// File-bridge askpass — never shows its own UI.
fn ensure_askpass_helper() -> Option<PathBuf> {
    let dir = dirs::data_local_dir()?.join("gitorade");
    fs::create_dir_all(&dir).ok()?;
    let _ = askpass_dir();

    let ps1 = dir.join("ssh-askpass.ps1");
    let cmd = dir.join("ssh-askpass.cmd");

    let ps1_body = r#"param([Parameter(ValueFromRemainingArguments=$true)][string[]]$PromptParts)
$ErrorActionPreference = 'Stop'
$Prompt = if ($PromptParts) { $PromptParts -join ' ' } else { 'Enter passphrase for SSH key' }
$dir = Join-Path $env:LOCALAPPDATA 'gitorade\askpass'
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$id = [guid]::NewGuid().ToString('N')
$reqPath = Join-Path $dir 'request.json'
$tmp = Join-Path $dir ("request.$id.tmp")
$payload = @{ requestId = $id; prompt = $Prompt } | ConvertTo-Json -Compress
[System.IO.File]::WriteAllText($tmp, $payload, [System.Text.UTF8Encoding]::new($false))
Move-Item -Force -Path $tmp -Destination $reqPath
$deadline = (Get-Date).AddMinutes(5)
while ((Get-Date) -lt $deadline) {
  $resp = Join-Path $dir ("response.$id")
  $cancel = Join-Path $dir ("cancel.$id")
  if (Test-Path -LiteralPath $cancel) {
    Remove-Item -LiteralPath $cancel -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $reqPath -Force -ErrorAction SilentlyContinue
    exit 1
  }
  if (Test-Path -LiteralPath $resp) {
    $text = [System.IO.File]::ReadAllText($resp)
    Remove-Item -LiteralPath $resp -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $reqPath -Force -ErrorAction SilentlyContinue
    [Console]::Out.Write($text)
    exit 0
  }
  Start-Sleep -Milliseconds 120
}
Remove-Item -LiteralPath $reqPath -Force -ErrorAction SilentlyContinue
exit 1
"#;

    let cmd_body =
        "@echo off\r\npowershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"%~dp0ssh-askpass.ps1\" %*\r\n";

    fs::write(&ps1, ps1_body).ok()?;
    fs::write(&cmd, cmd_body).ok()?;
    Some(cmd)
}

fn try_start_windows_ssh_agent_once() {
    static START: Once = Once::new();
    START.call_once(|| {
        #[cfg(windows)]
        {
            let _ = std::process::Command::new("powershell")
                .args([
                    "-NoProfile",
                    "-ExecutionPolicy",
                    "Bypass",
                    "-WindowStyle",
                    "Hidden",
                    "-Command",
                    "try { $s = Get-Service ssh-agent -ErrorAction Stop; if ($s.StartType -eq 'Disabled') { Set-Service ssh-agent -StartupType Manual -ErrorAction SilentlyContinue }; if ($s.Status -ne 'Running') { Start-Service ssh-agent -ErrorAction SilentlyContinue } } catch {}",
                ])
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null())
                .status();
        }
    });
}

static BRIDGE_STARTED: AtomicBool = AtomicBool::new(false);
static LAST_EMITTED: Mutex<Option<String>> = Mutex::new(None);

pub fn start_askpass_bridge(app: AppHandle) {
    if BRIDGE_STARTED.swap(true, Ordering::SeqCst) {
        return;
    }
    let _ = askpass_dir();

    thread::spawn(move || {
        loop {
            if let Some(req) = try_read_pending_request() {
                let should_emit = {
                    let mut last = LAST_EMITTED.lock().unwrap_or_else(|e| e.into_inner());
                    if last.as_deref() == Some(req.request_id.as_str()) {
                        false
                    } else {
                        *last = Some(req.request_id.clone());
                        true
                    }
                };
                if should_emit {
                    if let Some(win) = app.get_webview_window("main") {
                        let _ = win.set_focus();
                    }
                    let _ = app.emit(ASKPASS_EVENT, &req);
                }
            }
            thread::sleep(Duration::from_millis(100));
        }
    });
}

fn try_read_pending_request() -> Option<AskpassRequest> {
    let dir = askpass_dir()?;
    let path = dir.join("request.json");
    if !path.is_file() {
        return None;
    }
    let raw = fs::read_to_string(&path).ok()?;
    let req: AskpassRequest = serde_json::from_str(raw.trim()).ok()?;
    let resp = dir.join(format!("response.{}", req.request_id));
    let cancel = dir.join(format!("cancel.{}", req.request_id));
    if resp.exists() || cancel.exists() {
        return None;
    }
    Some(req)
}

pub fn respond_askpass(request_id: &str, passphrase: Option<&str>) -> crate::error::AppResult<()> {
    use crate::error::AppError;

    let id = request_id.trim();
    if id.is_empty() {
        return Err(AppError::Message("requestId inválido.".into()));
    }
    let dir = askpass_dir().ok_or_else(|| AppError::Message("Pasta askpass indisponível.".into()))?;

    if let Some(pass) = passphrase {
        let path = dir.join(format!("response.{id}"));
        let tmp = dir.join(format!("response.{id}.tmp"));
        fs::write(&tmp, pass).map_err(AppError::Io)?;
        fs::rename(&tmp, &path).map_err(AppError::Io)?;
    } else {
        let path = dir.join(format!("cancel.{id}"));
        fs::write(&path, b"1").map_err(AppError::Io)?;
    }

    if let Ok(mut last) = LAST_EMITTED.lock() {
        if last.as_deref() == Some(id) {
            *last = None;
        }
    }
    let _ = fs::remove_file(dir.join("request.json"));
    Ok(())
}

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
        "A chave SSH parece protegida por senha. Confirme a passphrase no painel \
         da operação (ou carregue a chave no ssh-agent com ssh-add).\n",
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
