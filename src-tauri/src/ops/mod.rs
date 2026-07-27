use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::path::Path;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;

use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::error::{AppError, AppResult};
use crate::git::redact_secrets;

pub const PROGRESS_EVENT: &str = "git://progress";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressEvent {
    pub operation_id: String,
    pub stream: String,
    pub message: String,
    pub percent: Option<u8>,
    pub done: bool,
    pub success: Option<bool>,
}

#[derive(Default)]
pub struct OperationRegistry {
    children: Mutex<HashMap<String, Arc<Mutex<Child>>>>,
}

impl OperationRegistry {
    pub fn cancel(&self, operation_id: &str) -> AppResult<()> {
        let child = {
            let map = self
                .children
                .lock()
                .map_err(|_| AppError::Message("Falha ao acessar operações.".into()))?;
            map.get(operation_id).cloned()
        };

        match child {
            Some(child) => {
                let mut guard = child
                    .lock()
                    .map_err(|_| AppError::Message("Falha ao cancelar operação.".into()))?;
                let _ = guard.kill();
                Ok(())
            }
            None => Err(AppError::Message("Operação não encontrada.".into())),
        }
    }

    fn insert(&self, id: String, child: Arc<Mutex<Child>>) {
        if let Ok(mut map) = self.children.lock() {
            map.insert(id, child);
        }
    }

    fn remove(&self, id: &str) {
        if let Ok(mut map) = self.children.lock() {
            map.remove(id);
        }
    }
}

/// Runs a git command streaming progress lines as Tauri events.
/// Args are passed directly to the process (never through a shell).
pub fn run_streaming(
    app: &AppHandle,
    registry: &OperationRegistry,
    operation_id: &str,
    args: &[String],
    cwd: Option<&Path>,
    ssh_key: Option<&Path>,
) -> AppResult<String> {
    let mut cmd = Command::new("git");
    crate::process_util::hide_console(&mut cmd);
    crate::git::apply_git_remote_env(&mut cmd, ssh_key);
    cmd.args(["-c", "credential.interactive=false"])
        .args(args)
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GIT_FLUSH", "1")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Some(dir) = cwd {
        cmd.current_dir(dir);
    }

    let mut child = cmd.spawn().map_err(|err| {
        if err.kind() == std::io::ErrorKind::NotFound {
            AppError::Message(
                "Git não encontrado. Instale o Git for Windows e reinicie o Gitorade.".into(),
            )
        } else {
            AppError::Io(err)
        }
    })?;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    let child = Arc::new(Mutex::new(child));
    registry.insert(operation_id.to_string(), child.clone());

    let collected = Arc::new(Mutex::new(String::new()));

    let mut handles = Vec::new();

    if let Some(out) = stdout {
        handles.push(spawn_reader(
            app.clone(),
            operation_id.to_string(),
            "stdout",
            out,
            Some(collected.clone()),
        ));
    }
    if let Some(err) = stderr {
        handles.push(spawn_reader(
            app.clone(),
            operation_id.to_string(),
            "stderr",
            err,
            None,
        ));
    }

    for handle in handles {
        let _ = handle.join();
    }

    let status = {
        let mut guard = child
            .lock()
            .map_err(|_| AppError::Message("Falha ao finalizar operação.".into()))?;
        guard.wait().map_err(AppError::Io)?
    };

    registry.remove(operation_id);

    let output = collected
        .lock()
        .map(|s| s.clone())
        .unwrap_or_default();

    let success = status.success();
    let _ = app.emit(
        PROGRESS_EVENT,
        ProgressEvent {
            operation_id: operation_id.to_string(),
            stream: "system".into(),
            message: if success {
                "Concluído.".into()
            } else {
                "Falhou ou cancelado.".into()
            },
            percent: if success { Some(100) } else { None },
            done: true,
            success: Some(success),
        },
    );

    if !success {
        return Err(AppError::Message(if output.trim().is_empty() {
            "Operação falhou ou foi cancelada.".into()
        } else {
            crate::git::enhance_ssh_error(&redact_secrets(output.trim()))
        }));
    }

    Ok(output)
}

fn spawn_reader<R: std::io::Read + Send + 'static>(
    app: AppHandle,
    operation_id: String,
    stream: &'static str,
    reader: R,
    collect: Option<Arc<Mutex<String>>>,
) -> thread::JoinHandle<()> {
    thread::spawn(move || {
        let buf = BufReader::new(reader);
        for line in split_progress_lines(buf) {
            let redacted = redact_secrets(&line);
            if let Some(ref sink) = collect {
                if let Ok(mut s) = sink.lock() {
                    s.push_str(&redacted);
                    s.push('\n');
                }
            }
            let percent = parse_percent(&redacted);
            let _ = app.emit(
                PROGRESS_EVENT,
                ProgressEvent {
                    operation_id: operation_id.clone(),
                    stream: stream.to_string(),
                    message: redacted,
                    percent,
                    done: false,
                    success: None,
                },
            );
        }
    })
}

/// Git progress uses carriage returns to update the same line; split on both.
fn split_progress_lines<R: BufRead>(mut reader: R) -> Vec<String> {
    let mut result = Vec::new();
    let mut buffer = Vec::new();
    let mut byte = [0u8; 1];
    loop {
        match std::io::Read::read(&mut reader, &mut byte) {
            Ok(0) => break,
            Ok(_) => {
                let b = byte[0];
                if b == b'\n' || b == b'\r' {
                    if !buffer.is_empty() {
                        result.push(String::from_utf8_lossy(&buffer).to_string());
                        buffer.clear();
                    }
                } else {
                    buffer.push(b);
                }
            }
            Err(_) => break,
        }
    }
    if !buffer.is_empty() {
        result.push(String::from_utf8_lossy(&buffer).to_string());
    }
    result
}

fn parse_percent(line: &str) -> Option<u8> {
    let idx = line.find('%')?;
    let start = line[..idx]
        .rfind(|c: char| !c.is_ascii_digit())
        .map(|i| i + 1)
        .unwrap_or(0);
    line[start..idx].parse::<u8>().ok().map(|v| v.min(100))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_percent_from_progress() {
        assert_eq!(parse_percent("Receiving objects:  45% (123/456)"), Some(45));
        assert_eq!(parse_percent("Resolving deltas: 100% (10/10), done."), Some(100));
        assert_eq!(parse_percent("remote: Counting objects"), None);
    }
}
