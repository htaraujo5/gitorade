//! In-app updates from GitHub Releases.
//!
//! Picks the installer published by `.github/workflows/release.yml` for the running
//! OS/arch (`-setup.exe`, `.dmg`, `.deb`), downloads it (verifying the GitHub `sha256`
//! digest when available) and hands it to the platform installer.

use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{Duration, Instant};

use serde::Serialize;
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter};

use crate::domain::UpdateInfo;
use crate::error::{AppError, AppResult};

const REPO: &str = "htaraujo5/gitorade";
pub const UPDATE_PROGRESS_EVENT: &str = "update://progress";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct UpdateProgress {
    downloaded: u64,
    total: Option<u64>,
    stage: &'static str,
}

struct ReleaseAsset {
    name: String,
    url: String,
    size: Option<u64>,
    sha256: Option<String>,
}

fn agent() -> ureq::Agent {
    ureq::AgentBuilder::new()
        .timeout_connect(Duration::from_secs(15))
        .timeout_read(Duration::from_secs(60))
        .user_agent(&format!("Gitorade/{} (+https://github.com/{REPO})", env!("CARGO_PKG_VERSION")))
        .build()
}

fn http_err(err: ureq::Error) -> AppError {
    match err {
        ureq::Error::Status(403, _) | ureq::Error::Status(429, _) => AppError::Message(
            "Limite de consultas ao GitHub atingido. Tente novamente mais tarde.".into(),
        ),
        ureq::Error::Status(404, _) => {
            AppError::Message("Nenhuma release publicada encontrada no GitHub.".into())
        }
        ureq::Error::Status(code, _) => {
            AppError::Message(format!("GitHub respondeu com HTTP {code}."))
        }
        ureq::Error::Transport(t) => AppError::Message(format!(
            "Sem conexão com o GitHub para verificar atualizações ({t})."
        )),
    }
}

pub fn parse_semver(v: &str) -> Option<(u64, u64, u64)> {
    let v = v.trim().trim_start_matches(['v', 'V']);
    let core = v.split(['-', '+']).next()?;
    let mut it = core.split('.');
    let major = it.next()?.parse().ok()?;
    let minor = it.next().unwrap_or("0").parse().ok()?;
    let patch = it.next().unwrap_or("0").parse().ok()?;
    Some((major, minor, patch))
}

pub fn is_newer(latest: &str, current: &str) -> bool {
    match (parse_semver(latest), parse_semver(current)) {
        (Some(l), Some(c)) => l > c,
        _ => false,
    }
}

/// Chooses the installer for the running platform from release asset names.
pub fn pick_asset_name<'a>(names: &[&'a str], os: &str, arch: &str) -> Option<&'a str> {
    let lower: Vec<(String, &'a str)> = names.iter().map(|n| (n.to_lowercase(), *n)).collect();
    let find = |pred: &dyn Fn(&str) -> bool| lower.iter().find(|(l, _)| pred(l)).map(|(_, n)| *n);
    match os {
        "windows" => find(&|l| l.ends_with("-setup.exe")).or_else(|| find(&|l| l.ends_with(".msi"))),
        "macos" => {
            let tag = if arch == "aarch64" { "aarch64" } else { "x64" };
            find(&|l| l.ends_with(".dmg") && l.contains(tag))
                .or_else(|| find(&|l| l.ends_with(".dmg") && (l.contains("universal"))))
        }
        "linux" => {
            let tag = if arch == "aarch64" { "arm64" } else { "amd64" };
            find(&|l| l.ends_with(".deb") && l.contains(tag))
        }
        _ => None,
    }
}

fn fetch_latest() -> AppResult<(UpdateInfo, Option<ReleaseAsset>)> {
    let url = format!("https://api.github.com/repos/{REPO}/releases/latest");
    let body: serde_json::Value = agent()
        .get(&url)
        .set("Accept", "application/vnd.github+json")
        .call()
        .map_err(http_err)?
        .into_json()
        .map_err(AppError::Io)?;

    let tag = body["tag_name"].as_str().unwrap_or_default().to_string();
    let current = env!("CARGO_PKG_VERSION").to_string();
    let latest = tag.trim_start_matches(['v', 'V']).to_string();

    let assets: Vec<ReleaseAsset> = body["assets"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|a| {
                    Some(ReleaseAsset {
                        name: a["name"].as_str()?.to_string(),
                        url: a["browser_download_url"].as_str()?.to_string(),
                        size: a["size"].as_u64(),
                        sha256: a["digest"]
                            .as_str()
                            .and_then(|d| d.strip_prefix("sha256:"))
                            .map(|s| s.to_ascii_lowercase()),
                    })
                })
                .collect()
        })
        .unwrap_or_default();

    let names: Vec<&str> = assets.iter().map(|a| a.name.as_str()).collect();
    let picked = pick_asset_name(&names, std::env::consts::OS, std::env::consts::ARCH)
        .map(str::to_string);
    let asset = picked.and_then(|name| assets.into_iter().find(|a| a.name == name));

    let info = UpdateInfo {
        available: is_newer(&latest, &current),
        current_version: current,
        latest_version: latest,
        notes: body["body"].as_str().unwrap_or_default().to_string(),
        release_url: body["html_url"]
            .as_str()
            .map(str::to_string)
            .unwrap_or_else(|| format!("https://github.com/{REPO}/releases/latest")),
        published_at: body["published_at"].as_str().map(str::to_string),
        asset_name: asset.as_ref().map(|a| a.name.clone()),
        asset_url: asset.as_ref().map(|a| a.url.clone()),
        asset_size: asset.as_ref().and_then(|a| a.size),
    };
    Ok((info, asset))
}

pub fn check() -> AppResult<UpdateInfo> {
    fetch_latest().map(|(info, _)| info)
}

fn is_trusted_download(url: &str) -> bool {
    url.starts_with(&format!("https://github.com/{REPO}/releases/download/"))
}

fn download(app: &AppHandle, asset: &ReleaseAsset) -> AppResult<PathBuf> {
    if !is_trusted_download(&asset.url) {
        return Err(AppError::Message("URL de download não confiável.".into()));
    }
    if asset.name.contains(['/', '\\']) || asset.name.starts_with('.') {
        return Err(AppError::Message("Nome de arquivo de atualização inválido.".into()));
    }
    let dir = std::env::temp_dir().join("gitorade-update");
    std::fs::create_dir_all(&dir)?;
    let target = dir.join(&asset.name);
    let partial = dir.join(format!("{}.part", asset.name));

    let resp = agent().get(&asset.url).call().map_err(http_err)?;
    let total = resp
        .header("Content-Length")
        .and_then(|v| v.parse::<u64>().ok())
        .or(asset.size);
    let mut reader = resp.into_reader();
    let mut file = std::fs::File::create(&partial)?;
    let mut hasher = Sha256::new();
    let mut buf = vec![0u8; 64 * 1024];
    let mut downloaded: u64 = 0;
    let mut last_emit = Instant::now();

    loop {
        let n = reader.read(&mut buf)?;
        if n == 0 {
            break;
        }
        file.write_all(&buf[..n])?;
        hasher.update(&buf[..n]);
        downloaded += n as u64;
        if last_emit.elapsed() >= Duration::from_millis(120) {
            last_emit = Instant::now();
            let _ = app.emit(
                UPDATE_PROGRESS_EVENT,
                UpdateProgress { downloaded, total, stage: "download" },
            );
        }
    }
    file.flush()?;
    drop(file);

    if let Some(expected) = total {
        if downloaded != expected {
            let _ = std::fs::remove_file(&partial);
            return Err(AppError::Message(
                "Download da atualização incompleto. Tente novamente.".into(),
            ));
        }
    }
    if let Some(expected) = &asset.sha256 {
        let actual = format!("{:x}", hasher.finalize());
        if &actual != expected {
            let _ = std::fs::remove_file(&partial);
            return Err(AppError::Message(
                "Checksum da atualização não confere — download descartado.".into(),
            ));
        }
    }

    std::fs::rename(&partial, &target)?;
    let _ = app.emit(
        UPDATE_PROGRESS_EVENT,
        UpdateProgress { downloaded, total, stage: "install" },
    );
    Ok(target)
}

/// Downloads and installs the latest release. Returns what the UI should do next:
/// - `"restart"`: installed in place, call `relaunch_app`
/// - `"exit"`: an external installer is running, the app should quit
/// - `"manual"`: installer opened for the user to finish (macOS DMG)
pub fn install(app: &AppHandle) -> AppResult<String> {
    if cfg!(debug_assertions) {
        return Err(AppError::Message(
            "Atualização automática desativada em builds de desenvolvimento.".into(),
        ));
    }
    let (info, asset) = fetch_latest()?;
    if !info.available {
        return Err(AppError::Message("Você já está na versão mais recente.".into()));
    }
    let asset = asset.ok_or_else(|| {
        AppError::Message(
            "Esta release não tem instalador para o seu sistema. Baixe manualmente pela página da release."
                .into(),
        )
    })?;
    let file = download(app, &asset)?;
    install_file(&file)
}

#[cfg(target_os = "linux")]
fn install_file(file: &Path) -> AppResult<String> {
    let exe = std::env::current_exe().unwrap_or_default();
    if !exe.starts_with("/usr") {
        return Err(AppError::Message(format!(
            "O Gitorade não foi instalado pelo pacote .deb, então não dá para atualizar automaticamente.\nInstale manualmente: sudo apt install {}",
            file.display()
        )));
    }
    let status = Command::new("pkexec")
        .args(["apt-get", "install", "-y", "--allow-downgrades"])
        .arg(file)
        .status()
        .map_err(|err| {
            if err.kind() == std::io::ErrorKind::NotFound {
                AppError::Message(format!(
                    "pkexec não encontrado. Instale manualmente: sudo apt install {}",
                    file.display()
                ))
            } else {
                AppError::Io(err)
            }
        })?;
    if !status.success() {
        return Err(AppError::Message(
            "Instalação cancelada ou falhou (senha de administrador necessária).".into(),
        ));
    }
    Ok("restart".into())
}

#[cfg(target_os = "windows")]
fn install_file(file: &Path) -> AppResult<String> {
    let mut cmd = Command::new(file);
    crate::process_util::hide_console(&mut cmd);
    cmd.spawn().map_err(AppError::Io)?;
    Ok("exit".into())
}

#[cfg(target_os = "macos")]
fn install_file(file: &Path) -> AppResult<String> {
    Command::new("open").arg(file).spawn().map_err(AppError::Io)?;
    Ok("manual".into())
}

#[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
fn install_file(_file: &Path) -> AppResult<String> {
    Err(AppError::Message("Atualização automática não suportada neste sistema.".into()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compares_versions() {
        assert!(is_newer("2.1.0", "2.0.4"));
        assert!(is_newer("v3.0.0", "2.9.9"));
        assert!(!is_newer("2.0.4", "2.0.4"));
        assert!(!is_newer("2.0.3", "2.0.4"));
        assert!(!is_newer("garbage", "2.0.4"));
    }

    #[test]
    fn picks_installer_per_platform() {
        let names = [
            "Gitorade_2.1.0_x64-setup.exe",
            "Gitorade_2.1.0_x64_en-US.msi",
            "Gitorade_2.1.0_aarch64.dmg",
            "Gitorade_2.1.0_x64.dmg",
            "Gitorade_2.1.0_amd64.deb",
        ];
        assert_eq!(
            pick_asset_name(&names, "windows", "x86_64"),
            Some("Gitorade_2.1.0_x64-setup.exe")
        );
        assert_eq!(
            pick_asset_name(&names, "macos", "aarch64"),
            Some("Gitorade_2.1.0_aarch64.dmg")
        );
        assert_eq!(pick_asset_name(&names, "macos", "x86_64"), Some("Gitorade_2.1.0_x64.dmg"));
        assert_eq!(pick_asset_name(&names, "linux", "x86_64"), Some("Gitorade_2.1.0_amd64.deb"));
        assert_eq!(pick_asset_name(&names, "linux", "aarch64"), None);
    }

    #[test]
    fn only_trusts_release_downloads() {
        assert!(is_trusted_download(
            "https://github.com/htaraujo5/gitorade/releases/download/v2.1.0/a.deb"
        ));
        assert!(!is_trusted_download("https://evil.example/a.deb"));
        assert!(!is_trusted_download("https://github.com/other/repo/releases/download/x/a.deb"));
    }
}
