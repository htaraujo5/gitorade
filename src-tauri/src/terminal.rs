//! Interactive terminal sessions via portable-pty (Windows ConPTY).

use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::thread;

use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use crate::error::{AppError, AppResult};

pub const TERMINAL_EVENT: &str = "terminal://data";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalDataEvent {
    pub session_id: String,
    pub data: String,
    pub done: bool,
}

struct Session {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    _child: Box<dyn portable_pty::Child + Send + Sync>,
}

pub struct TerminalRegistry {
    sessions: Mutex<HashMap<String, Session>>,
    enabled: AtomicBool,
}

impl Default for TerminalRegistry {
    fn default() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
            enabled: AtomicBool::new(true),
        }
    }
}

impl TerminalRegistry {
    pub fn set_enabled(&self, enabled: bool) {
        self.enabled.store(enabled, Ordering::SeqCst);
        if !enabled {
            let _ = self.kill_all();
        }
    }

    pub fn is_enabled(&self) -> bool {
        self.enabled.load(Ordering::SeqCst)
    }

    pub fn create(
        &self,
        app: AppHandle,
        cwd: Option<&Path>,
        cols: u16,
        rows: u16,
    ) -> AppResult<String> {
        if !self.is_enabled() {
            return Err(AppError::Message(
                "Terminal desabilitado nas preferências.".into(),
            ));
        }
        let session_id = Uuid::new_v4().to_string();
        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows: rows.max(8),
                cols: cols.max(40),
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| AppError::Message(format!("Falha ao abrir PTY: {e}")))?;

        let shell = default_shell();
        let mut cmd = CommandBuilder::new(&shell.program);
        for arg in &shell.args {
            cmd.arg(arg);
        }
        if let Some(dir) = cwd {
            cmd.cwd(dir);
        }
        cmd.env("TERM", "xterm-256color");

        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| AppError::Message(format!("Falha ao iniciar shell: {e}")))?;

        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| AppError::Message(format!("Falha ao ler PTY: {e}")))?;
        let writer = pair
            .master
            .take_writer()
            .map_err(|e| AppError::Message(format!("Falha ao escrever PTY: {e}")))?;

        let sid = session_id.clone();
        thread::spawn(move || {
            let mut buf = [0u8; 4096];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => {
                        let _ = app.emit(
                            TERMINAL_EVENT,
                            TerminalDataEvent {
                                session_id: sid.clone(),
                                data: String::new(),
                                done: true,
                            },
                        );
                        break;
                    }
                    Ok(n) => {
                        let data = String::from_utf8_lossy(&buf[..n]).to_string();
                        let _ = app.emit(
                            TERMINAL_EVENT,
                            TerminalDataEvent {
                                session_id: sid.clone(),
                                data,
                                done: false,
                            },
                        );
                    }
                    Err(_) => {
                        let _ = app.emit(
                            TERMINAL_EVENT,
                            TerminalDataEvent {
                                session_id: sid.clone(),
                                data: String::new(),
                                done: true,
                            },
                        );
                        break;
                    }
                }
            }
        });

        let session = Session {
            master: pair.master,
            writer,
            _child: child,
        };

        self.sessions
            .lock()
            .map_err(|_| AppError::Message("Lock do terminal.".into()))?
            .insert(session_id.clone(), session);

        Ok(session_id)
    }

    pub fn write(&self, session_id: &str, data: &str) -> AppResult<()> {
        if !self.is_enabled() {
            return Err(AppError::Message(
                "Terminal desabilitado nas preferências.".into(),
            ));
        }
        let mut map = self
            .sessions
            .lock()
            .map_err(|_| AppError::Message("Lock do terminal.".into()))?;
        let session = map
            .get_mut(session_id)
            .ok_or_else(|| AppError::Message("Sessão de terminal não encontrada.".into()))?;
        session
            .writer
            .write_all(data.as_bytes())
            .map_err(AppError::Io)?;
        session.writer.flush().map_err(AppError::Io)?;
        Ok(())
    }

    pub fn resize(&self, session_id: &str, cols: u16, rows: u16) -> AppResult<()> {
        let map = self
            .sessions
            .lock()
            .map_err(|_| AppError::Message("Lock do terminal.".into()))?;
        let session = map
            .get(session_id)
            .ok_or_else(|| AppError::Message("Sessão de terminal não encontrada.".into()))?;
        session
            .master
            .resize(PtySize {
                rows: rows.max(8),
                cols: cols.max(40),
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| AppError::Message(format!("Resize PTY: {e}")))?;
        Ok(())
    }

    pub fn kill(&self, session_id: &str) -> AppResult<()> {
        let mut map = self
            .sessions
            .lock()
            .map_err(|_| AppError::Message("Lock do terminal.".into()))?;
        map.remove(session_id);
        Ok(())
    }

    pub fn kill_all(&self) -> AppResult<()> {
        let mut map = self
            .sessions
            .lock()
            .map_err(|_| AppError::Message("Lock do terminal.".into()))?;
        map.clear();
        Ok(())
    }
}

struct ShellSpec {
    program: String,
    args: Vec<String>,
}

fn default_shell() -> ShellSpec {
    let candidates = [
        (
            r"C:\Program Files\PowerShell\7\pwsh.exe",
            vec!["-NoLogo".into()],
        ),
        (
            r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe",
            vec!["-NoLogo".into()],
        ),
        (r"C:\Windows\System32\cmd.exe", vec![]),
    ];
    for (program, args) in candidates {
        if PathBuf::from(program).exists() {
            return ShellSpec {
                program: program.into(),
                args,
            };
        }
    }
    ShellSpec {
        program: "cmd.exe".into(),
        args: vec![],
    }
}
