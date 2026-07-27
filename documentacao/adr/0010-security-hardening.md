# ADR 0010 — Security hardening (path, SSH, CSP, askpass)

## Status

Accepted

## Context

Auditoria do backend Tauri/Rust apontou path traversal em resolução de
conflitos, interpolação insegura de `ssh_key_path` em `GIT_SSH_COMMAND`, CSP
nula, option injection em clone/refs, askpass com arquivos plaintext e
`StrictHostKeyChecking=accept-new`.

## Decision

### Path containment

- Módulo `git/path_guard.rs` com `assert_repo_relative` e `resolve_under_repo`.
- Usado em conflict read/write, stage/unstage/diff e history file APIs.
- Frontend espelha a regra antes de `openPath`.

### SSH / remotes

- `validate_ssh_key_path` (allowlist de caracteres) antes de montar
  `GIT_SSH_COMMAND` e ao criar/atualizar perfis.
- Path inválido: omite `-i` (cai no agent) em vez de interpolar.
- `StrictHostKeyChecking=yes` (sem `accept-new`); erros de host key explicam
  `known_hosts`.
- Askpass: token de sessão (`GITORADE_ASKPASS_TOKEN`) + mapa pending in-memory;
  `respond_ssh_askpass` rejeita IDs desconhecidos; requests forjados sem token
  válido não disparam UI. ssh-agent via `sc.exe` (sem PowerShell Bypass).

### Argv / URL

- `reject_option_like` e `validate_remote_url` em clone, remotes, branches,
  merge/rebase/cherry-pick/reset/revert.

### WebView

- CSP restritiva em `tauri.conf.json` (`script-src 'self'`, `unsafe-inline` só
  em styles; `img-src` permite Gravatar; `connect-src` para IPC Tauri).
- Opener limitado a `https://github.com/*` (+ path open para arquivos do repo).

### Produto

- Pref `enableTerminal` + gate no backend; kill de sessões ao trocar repo.
- `requireDangerousConfirm` respeita `confirmDangerous`.
- `file_at_commit` sem textconv / com `diff.external=` vazio.
- Redaction cobre `user:pass@` e mais prefixes de token.

### Release / supply chain

- Workflow Release usa environment `release` (revisores no GitHub).
- Job `audit` no CI (`npm audit` + `cargo audit`, continue-on-error até baseline).

## Consequences

- XSS no WebView continua grave (terminal/IPC), mas CSP + path/SSH guards
  reduzem o blast radius.
- Hosts SSH novos exigem `known_hosts` prévio (melhor DX via UI TOFU fica
  para depois).
- Authenticode signing permanece fora deste ADR até haver certificado.
