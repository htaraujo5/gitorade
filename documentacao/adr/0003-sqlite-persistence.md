# ADR 0003 — Persistência: SQLite no backend

## Status

Accepted

## Context

Precisamos persistir repositórios, perfis, associações e preferências de forma confiável em desktop. IndexedDB no WebView é frágil para esse caso.

## Decision

Usar **SQLite** no backend Tauri, com migrations versionadas.

- Tabelas iniciais: `profiles`, `repositories`, `repository_profiles`, `preferences`.
- Segredos **não** ficam no SQLite.

## Consequences

- Acesso ao banco somente pelo Rust.
- Schema evolui via migrations explícitas.
- Facilita backup/diagnóstico local.
