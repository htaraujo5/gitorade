# ADR 0004 — Segurança de credenciais e identidades

## Status

Accepted

## Context

O diferencial do produto é multi-identidade. Identidade de commit (nome/email) é distinta de autenticação remota (SSH/HTTPS tokens).

## Decision

- **Identidade de commit:** nome/email (+ caminho opcional de chave SSH) em SQLite; associação por repositório; override por commit via env/`GIT_AUTHOR_*`/`GIT_COMMITTER_*` sem alterar config global.
- **Autenticação remota:** preferir SSH Agent e Git Credential Manager.
- Segredos controlados pelo app: **Windows Credential Manager**.
- Frontend nunca recebe tokens; logs com redaction.

## Consequences

- UX deve sempre mostrar identidade ativa.
- Integração com GCM/SSH Agent reduz superfície de armazenamento de segredos.
- Tokens nunca em logs, toasts ou estado persistido do frontend.
