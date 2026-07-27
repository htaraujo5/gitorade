use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;

use crate::domain::{CreateProfileInput, Profile, Repository, UpdateProfileInput};
use crate::error::{AppError, AppResult};
use crate::git;

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn open_default() -> AppResult<Self> {
        let path = app_data_dir()?.join("gitorade.db");
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        let conn = Connection::open(path)?;
        let db = Self {
            conn: Mutex::new(conn),
        };
        db.migrate()?;
        Ok(db)
    }

    fn with_conn<T>(&self, f: impl FnOnce(&Connection) -> AppResult<T>) -> AppResult<T> {
        let conn = self
            .conn
            .lock()
            .map_err(|_| AppError::Message("Falha ao obter lock do banco.".into()))?;
        f(&conn)
    }

    pub fn migrate(&self) -> AppResult<()> {
        self.with_conn(|conn| {
            conn.execute_batch(include_str!("../../migrations/001_init.sql"))?;
            // Additive migrations for existing DBs (CREATE TABLE IF NOT EXISTS is not enough).
            let has_avatar: bool = conn
                .prepare("PRAGMA table_info(profiles)")?
                .query_map([], |row| row.get::<_, String>(1))?
                .filter_map(|c| c.ok())
                .any(|name| name == "avatar_data");
            if !has_avatar {
                conn.execute("ALTER TABLE profiles ADD COLUMN avatar_data TEXT", [])?;
            }
            Ok(())
        })
    }

    pub fn ping(&self) -> AppResult<()> {
        self.with_conn(|conn| {
            conn.query_row("SELECT 1", [], |_| Ok(()))?;
            Ok(())
        })
    }

    pub fn list_profiles(&self) -> AppResult<Vec<Profile>> {
        self.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, name, email, ssh_key_path, provider, avatar_data, created_at, updated_at
                 FROM profiles ORDER BY name COLLATE NOCASE",
            )?;
            let rows = stmt
                .query_map([], map_profile)?
                .collect::<Result<Vec<_>, _>>()?;
            Ok(rows)
        })
    }

    pub fn get_profile(&self, id: &str) -> AppResult<Option<Profile>> {
        self.with_conn(|conn| {
            conn.query_row(
                "SELECT id, name, email, ssh_key_path, provider, avatar_data, created_at, updated_at
                 FROM profiles WHERE id = ?1",
                params![id],
                map_profile,
            )
            .optional()
            .map_err(AppError::from)
        })
    }

    pub fn create_profile(&self, input: CreateProfileInput) -> AppResult<Profile> {
        let name = input.name.trim().to_string();
        let email = input.email.trim().to_string();
        if name.is_empty() || email.is_empty() {
            return Err(AppError::Message("Nome e email são obrigatórios.".into()));
        }

        let avatar_data = normalize_avatar_data(input.avatar_data)?;
        let now = Utc::now().to_rfc3339();
        let profile = Profile {
            id: Uuid::new_v4().to_string(),
            name,
            email,
            ssh_key_path: empty_to_none(input.ssh_key_path),
            provider: empty_to_none(input.provider),
            avatar_data,
            created_at: now.clone(),
            updated_at: now,
        };

        self.with_conn(|conn| {
            conn.execute(
                "INSERT INTO profiles (id, name, email, ssh_key_path, provider, avatar_data, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    profile.id,
                    profile.name,
                    profile.email,
                    profile.ssh_key_path,
                    profile.provider,
                    profile.avatar_data,
                    profile.created_at,
                    profile.updated_at
                ],
            )?;
            Ok(())
        })?;

        Ok(profile)
    }

    pub fn update_profile(&self, input: UpdateProfileInput) -> AppResult<Profile> {
        let name = input.name.trim().to_string();
        let email = input.email.trim().to_string();
        if name.is_empty() || email.is_empty() {
            return Err(AppError::Message("Nome e email são obrigatórios.".into()));
        }

        let avatar_data = normalize_avatar_data(input.avatar_data)?;
        let now = Utc::now().to_rfc3339();
        self.with_conn(|conn| {
            let updated = conn.execute(
                "UPDATE profiles
                 SET name = ?2, email = ?3, ssh_key_path = ?4, provider = ?5, avatar_data = ?6, updated_at = ?7
                 WHERE id = ?1",
                params![
                    input.id,
                    name,
                    email,
                    empty_to_none(input.ssh_key_path),
                    empty_to_none(input.provider),
                    avatar_data,
                    now
                ],
            )?;
            if updated == 0 {
                return Err(AppError::Message("Perfil não encontrado.".into()));
            }
            Ok(())
        })?;

        self.get_profile(&input.id)?
            .ok_or_else(|| AppError::Message("Perfil não encontrado.".into()))
    }

    pub fn delete_profile(&self, id: &str) -> AppResult<()> {
        self.with_conn(|conn| {
            conn.execute(
                "UPDATE repositories SET default_profile_id = NULL WHERE default_profile_id = ?1",
                params![id],
            )?;
            let deleted = conn.execute("DELETE FROM profiles WHERE id = ?1", params![id])?;
            if deleted == 0 {
                return Err(AppError::Message("Perfil não encontrado.".into()));
            }
            Ok(())
        })
    }

    pub fn list_repositories(&self) -> AppResult<Vec<Repository>> {
        let mut repos = self.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, name, path, default_profile_id, is_favorite, last_opened_at, created_at, updated_at
                 FROM repositories
                 ORDER BY COALESCE(last_opened_at, created_at) DESC",
            )?;
            let rows = stmt
                .query_map([], map_repository_row)?
                .collect::<Result<Vec<_>, _>>()?;
            Ok(rows)
        })?;

        for repo in &mut repos {
            enrich_repository(self, repo)?;
        }
        Ok(repos)
    }

    pub fn get_repository(&self, id: &str) -> AppResult<Option<Repository>> {
        let mut repo = self.with_conn(|conn| {
            conn.query_row(
                "SELECT id, name, path, default_profile_id, is_favorite, last_opened_at, created_at, updated_at
                 FROM repositories WHERE id = ?1",
                params![id],
                map_repository_row,
            )
            .optional()
            .map_err(AppError::from)
        })?;

        if let Some(ref mut repo) = repo {
            enrich_repository(self, repo)?;
        }
        Ok(repo)
    }

    pub fn open_repository_path(&self, path: &str) -> AppResult<Repository> {
        let canonical = git::canonicalize_path(path)?;
        git::validate_repository(&canonical)?;

        let path_str = path_to_string(&canonical);
        let existing = self.with_conn(|conn| {
            conn.query_row(
                "SELECT id, name, path, default_profile_id, is_favorite, last_opened_at, created_at, updated_at
                 FROM repositories WHERE path = ?1",
                params![path_str],
                map_repository_row,
            )
            .optional()
            .map_err(AppError::from)
        })?;

        let now = Utc::now().to_rfc3339();
        let id = if let Some(repo) = existing {
            self.with_conn(|conn| {
                conn.execute(
                    "UPDATE repositories SET last_opened_at = ?2, updated_at = ?2 WHERE id = ?1",
                    params![repo.id, now],
                )?;
                Ok(())
            })?;
            repo.id
        } else {
            let id = Uuid::new_v4().to_string();
            let name = git::repo_name_from_path(&canonical);
            self.with_conn(|conn| {
                conn.execute(
                    "INSERT INTO repositories
                     (id, name, path, default_profile_id, is_favorite, last_opened_at, created_at, updated_at)
                     VALUES (?1, ?2, ?3, NULL, 0, ?4, ?4, ?4)",
                    params![id, name, path_str, now],
                )?;
                Ok(())
            })?;
            id
        };

        self.get_repository(&id)?
            .ok_or_else(|| AppError::Message("Falha ao abrir repositório.".into()))
    }

    pub fn set_repository_favorite(&self, id: &str, is_favorite: bool) -> AppResult<Repository> {
        self.with_conn(|conn| {
            let updated = conn.execute(
                "UPDATE repositories SET is_favorite = ?2, updated_at = ?3 WHERE id = ?1",
                params![id, if is_favorite { 1 } else { 0 }, Utc::now().to_rfc3339()],
            )?;
            if updated == 0 {
                return Err(AppError::Message("Repositório não encontrado.".into()));
            }
            Ok(())
        })?;
        self.get_repository(id)?
            .ok_or_else(|| AppError::Message("Repositório não encontrado.".into()))
    }

    pub fn set_repository_profile(
        &self,
        repository_id: &str,
        profile_id: Option<String>,
    ) -> AppResult<Repository> {
        if let Some(ref pid) = profile_id {
            if self.get_profile(pid)?.is_none() {
                return Err(AppError::Message("Perfil não encontrado.".into()));
            }
        }

        self.with_conn(|conn| {
            let updated = conn.execute(
                "UPDATE repositories SET default_profile_id = ?2, updated_at = ?3 WHERE id = ?1",
                params![repository_id, profile_id, Utc::now().to_rfc3339()],
            )?;
            if updated == 0 {
                return Err(AppError::Message("Repositório não encontrado.".into()));
            }
            Ok(())
        })?;

        self.get_repository(repository_id)?
            .ok_or_else(|| AppError::Message("Repositório não encontrado.".into()))
    }

    pub fn remove_repository(&self, id: &str) -> AppResult<()> {
        self.with_conn(|conn| {
            let deleted = conn.execute("DELETE FROM repositories WHERE id = ?1", params![id])?;
            if deleted == 0 {
                return Err(AppError::Message("Repositório não encontrado.".into()));
            }
            Ok(())
        })
    }
}

fn enrich_repository(db: &Database, repo: &mut Repository) -> AppResult<()> {
    let path = PathBuf::from(&repo.path);
    repo.branch = git::current_branch(&path).ok().flatten();
    repo.active_profile = match &repo.default_profile_id {
        Some(id) => db.get_profile(id)?,
        None => None,
    };
    Ok(())
}

fn map_profile(row: &rusqlite::Row<'_>) -> rusqlite::Result<Profile> {
    Ok(Profile {
        id: row.get(0)?,
        name: row.get(1)?,
        email: row.get(2)?,
        ssh_key_path: row.get(3)?,
        provider: row.get(4)?,
        avatar_data: row.get(5)?,
        created_at: row.get(6)?,
        updated_at: row.get(7)?,
    })
}

fn map_repository_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Repository> {
    Ok(Repository {
        id: row.get(0)?,
        name: row.get(1)?,
        path: row.get(2)?,
        default_profile_id: row.get(3)?,
        is_favorite: row.get::<_, i64>(4)? != 0,
        last_opened_at: row.get(5)?,
        created_at: row.get(6)?,
        updated_at: row.get(7)?,
        branch: None,
        active_profile: None,
    })
}

fn empty_to_none(value: Option<String>) -> Option<String> {
    value.and_then(|v| {
        let t = v.trim().to_string();
        if t.is_empty() { None } else { Some(t) }
    })
}

/// Accepts `data:image/(png|jpeg|jpg|webp|gif);base64,...` up to ~200KB.
fn normalize_avatar_data(value: Option<String>) -> AppResult<Option<String>> {
    let Some(raw) = empty_to_none(value) else {
        return Ok(None);
    };
    if !raw.starts_with("data:image/") || !raw.contains(";base64,") {
        return Err(AppError::Message(
            "Avatar inválido: use uma imagem PNG, JPEG ou WebP.".into(),
        ));
    }
    let mime = raw
        .trim_start_matches("data:")
        .split(';')
        .next()
        .unwrap_or("");
    if !matches!(
        mime,
        "image/png" | "image/jpeg" | "image/jpg" | "image/webp" | "image/gif"
    ) {
        return Err(AppError::Message(
            "Formato de avatar não suportado (use PNG, JPEG ou WebP).".into(),
        ));
    }
    if raw.len() > 220_000 {
        return Err(AppError::Message(
            "Avatar muito grande (máx. ~150KB). Escolha uma imagem menor.".into(),
        ));
    }
    Ok(Some(raw))
}

fn path_to_string(path: &std::path::Path) -> String {
    let s = path.to_string_lossy().to_string();
    // Windows canonicalize adds \\?\ prefix
    s.strip_prefix(r"\\?\").unwrap_or(&s).to_string()
}

fn app_data_dir() -> AppResult<PathBuf> {
    let base = dirs::data_dir().ok_or_else(|| {
        AppError::Message("Não foi possível resolver o diretório de dados do app.".into())
    })?;
    // Match Tauri NSIS `${BUNDLEID}` cleanup paths (`com.gitorade.desktop`).
    let dir = base.join("com.gitorade.desktop");
    let legacy = base.join("gitorade");
    if legacy.exists() && !dir.exists() {
        if fs::rename(&legacy, &dir).is_err() {
            // Fallback: copy then remove (e.g. cross-volume).
            fs::create_dir_all(&dir)?;
            if let Ok(entries) = fs::read_dir(&legacy) {
                for entry in entries.flatten() {
                    let dest = dir.join(entry.file_name());
                    let _ = fs::rename(entry.path(), &dest).or_else(|_| {
                        fs::copy(entry.path(), &dest).and_then(|_| fs::remove_file(entry.path()))
                    });
                }
            }
            let _ = fs::remove_dir_all(&legacy);
        }
    }
    Ok(dir)
}
