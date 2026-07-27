//! SSH env for remote Git + in-app AskPass bridge (no WinForms dialog).
//!
//! OpenSSH invokes our helper → request file (with session token) → Rust emits
//! `ssh://askpass` → OperationOverlay collects passphrase → `respond_ssh_askpass`.

use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, Once, OnceLock};
use std::thread;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};

use crate::git::path_guard::validate_ssh_key_path;

pub const ASKPASS_EVENT: &str = "ssh://askpass";
/// When set on the Git process env, a re-exec of this app runs headless askpass instead of the UI.
pub const ASKPASS_ENV: &str = "GITORADE_ASKPASS";
const ASKPASS_TOKEN_ENV: &str = "GITORADE_ASKPASS_TOKEN";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AskpassRequest {
    pub request_id: String,
    pub prompt: String,
    #[serde(default)]
    pub token: String,
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
    // Quote only validated absolute-ish ssh path; never interpolate untrusted input.
    let mut ssh_cmd = format!("\"{ssh}\"");
    ssh_cmd.push_str(" -o StrictHostKeyChecking=yes");

    let key = identity_file
        .filter(|p| p.is_file())
        .map(Path::to_path_buf)
        .or_else(discover_default_ssh_key);

    if let Some(key) = key {
        let key_s = key.to_string_lossy();
        if validate_ssh_key_path(key_s.as_ref()).is_ok() {
            ssh_cmd.push_str(&format!(" -i \"{key_s}\" -o IdentitiesOnly=yes"));
        }
        // Invalid key path: omit -i and rely on ssh-agent rather than shell-inject.
    }

    cmd.env("GIT_SSH_COMMAND", ssh_cmd);

    if let Some(askpass) = ensure_askpass_helper_cached() {
        let token = uuid::Uuid::new_v4().simple().to_string();
        register_askpass_token(&token);
        cmd.env("SSH_ASKPASS", askpass);
        cmd.env("SSH_ASKPASS_REQUIRE", "force");
        cmd.env("DISPLAY", "localhost:0");
        cmd.env(ASKPASS_ENV, "1");
        cmd.env(ASKPASS_TOKEN_ENV, &token);
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
            let s = path.to_string_lossy();
            if validate_ssh_key_path(s.as_ref()).is_ok() {
                return Some(path);
            }
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
    static ACL_ONCE: Once = Once::new();
    ACL_ONCE.call_once(|| tighten_askpass_dir_acl(&dir));
    Some(dir)
}

fn tighten_askpass_dir_acl(dir: &Path) {
    #[cfg(windows)]
    {
        // Best-effort: restrict to current user (LocalAppData is already per-user).
        let dir_s = dir.to_string_lossy();
        let mut cmd = std::process::Command::new(r"C:\Windows\System32\icacls.exe");
        crate::process_util::hide_console(&mut cmd);
        let _ = cmd
            .args([
                dir_s.as_ref(),
                "/inheritance:r",
                "/grant:r",
                &format!("{}:(OI)(CI)F", whoami_user()),
            ])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status();
    }
    let _ = dir;
}

#[cfg(windows)]
fn whoami_user() -> String {
    std::env::var("USERNAME").unwrap_or_else(|_| "Users".into())
}

/// Headless askpass: this same EXE (Windows GUI subsystem → no console flash).
fn ensure_askpass_helper() -> Option<PathBuf> {
    let _ = askpass_dir();
    std::env::current_exe().ok().filter(|p| p.is_file())
}

fn tokens() -> &'static Mutex<HashSet<String>> {
    static TOKENS: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();
    TOKENS.get_or_init(|| Mutex::new(HashSet::new()))
}

fn pending_requests() -> &'static Mutex<HashMap<String, Instant>> {
    static PENDING: OnceLock<Mutex<HashMap<String, Instant>>> = OnceLock::new();
    PENDING.get_or_init(|| Mutex::new(HashMap::new()))
}

fn register_askpass_token(token: &str) {
    if let Ok(mut set) = tokens().lock() {
        set.insert(token.to_string());
    }
}

fn token_is_valid(token: &str) -> bool {
    if token.is_empty() {
        return false;
    }
    tokens()
        .lock()
        .map(|set| set.contains(token))
        .unwrap_or(false)
}

fn register_pending_request(id: &str) {
    if let Ok(mut map) = pending_requests().lock() {
        map.insert(id.to_string(), Instant::now());
        map.retain(|_, t| t.elapsed() < Duration::from_secs(300));
    }
}

fn take_pending_request(id: &str) -> bool {
    pending_requests()
        .lock()
        .map(|mut map| map.remove(id).is_some())
        .unwrap_or(false)
}

/// Entry for `GITORADE_ASKPASS=1` re-exec — writes request, waits for UI, prints passphrase.
pub fn run_askpass_cli() -> i32 {
    use std::io::Write;

    let prompt = {
        let joined = std::env::args().skip(1).collect::<Vec<_>>().join(" ");
        if joined.trim().is_empty() {
            "Enter passphrase for SSH key".to_string()
        } else {
            joined
        }
    };

    let Some(dir) = askpass_dir() else {
        return 1;
    };

    let token = std::env::var(ASKPASS_TOKEN_ENV).unwrap_or_default();
    let id = uuid::Uuid::new_v4().simple().to_string();
    let req_path = dir.join("request.json");
    let tmp = dir.join(format!("request.{id}.tmp"));
    let payload = serde_json::json!({
        "requestId": id,
        "prompt": prompt,
        "token": token,
    });
    if fs::write(&tmp, payload.to_string()).is_err() {
        return 1;
    }
    if fs::rename(&tmp, &req_path).is_err() {
        let _ = fs::remove_file(&tmp);
        return 1;
    }

    let deadline = Instant::now() + Duration::from_secs(300);
    let resp_path = dir.join(format!("response.{id}"));
    let cancel_path = dir.join(format!("cancel.{id}"));

    while Instant::now() < deadline {
        if cancel_path.is_file() {
            let _ = fs::remove_file(&cancel_path);
            let _ = fs::remove_file(&req_path);
            return 1;
        }
        if resp_path.is_file() {
            let text = fs::read_to_string(&resp_path).unwrap_or_default();
            let _ = fs::remove_file(&resp_path);
            let _ = fs::remove_file(&req_path);
            let mut out = std::io::stdout();
            let _ = out.write_all(text.as_bytes());
            let _ = out.flush();
            return 0;
        }
        thread::sleep(Duration::from_millis(120));
    }

    let _ = fs::remove_file(&req_path);
    1
}

fn try_start_windows_ssh_agent_once() {
    static START: Once = Once::new();
    START.call_once(|| {
        #[cfg(windows)]
        {
            // Prefer sc.exe over PowerShell Bypass.
            let mut query = std::process::Command::new(r"C:\Windows\System32\sc.exe");
            crate::process_util::hide_console(&mut query);
            let running = query
                .args(["query", "ssh-agent"])
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null())
                .status()
                .map(|s| s.success())
                .unwrap_or(false);
            if running {
                let mut start = std::process::Command::new(r"C:\Windows\System32\sc.exe");
                crate::process_util::hide_console(&mut start);
                let _ = start
                    .args(["start", "ssh-agent"])
                    .stdout(std::process::Stdio::null())
                    .stderr(std::process::Stdio::null())
                    .status();
            }
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
                    register_pending_request(&req.request_id);
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
    if !token_is_valid(&req.token) {
        // Forged or stale request — ignore (do not prompt UI).
        return None;
    }
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
    if !take_pending_request(id) {
        return Err(AppError::Message(
            "Pedido askpass desconhecido ou expirado.".into(),
        ));
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
    let is_host_key = lower.contains("host key verification failed")
        || lower.contains("not found in known_hosts")
        || lower.contains("no matching host key");

    if is_host_key {
        let mut msg = String::from(raw.trim());
        msg.push_str(
            "\n\nHost SSH desconhecido ou chave alterada. Adicione o host em \
             ~/.ssh/known_hosts (ssh user@host) antes de sincronizar pelo Gitorade.\n",
        );
        return msg;
    }

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
    fn enhance_host_key_message() {
        let out = enhance_ssh_error("Host key verification failed.");
        assert!(out.contains("known_hosts"));
    }

    #[test]
    fn askpass_helper_resolves_exe() {
        let path = ensure_askpass_helper();
        assert!(path.is_some());
        assert!(path.unwrap().is_file());
    }

    #[test]
    fn respond_rejects_unknown_request() {
        let err = respond_askpass("deadbeefdeadbeefdeadbeefdeadbeef", Some("x"));
        assert!(err.is_err());
    }
}
