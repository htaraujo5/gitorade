# ADR 0007 — Operações remotas: streaming e autenticação

## Status

Accepted

## Context

Clone/fetch/pull/push são operações longas que precisam de progresso, cancelamento e autenticação segura, sem travar em prompts.

## Decision

- Executar via processo Git com `--progress`, lendo stdout/stderr por bytes (split em `\n` e `\r`) para capturar barras de progresso.
- Emitir eventos Tauri `git://progress` com `{ operationId, stream, message, percent, done, success }`.
- Cancelamento: registro de operações (`OperationRegistry`) guarda o `Child`; `cancel_operation` mata o processo.
- Autenticação:
  - `GIT_TERMINAL_PROMPT=0` e `credential.interactive=false` — nunca trava pedindo senha.
  - Depende de SSH Agent (SSH) e Git Credential Manager (HTTPS) já configurados no sistema.
- Segurança: todas as linhas passam por `redact_secrets` antes de ir para UI/estado.

## Consequences

- App não armazena tokens; delega ao GCM/SSH Agent.
- Falha de auth retorna erro acionável em vez de travar.
- Progresso e cancelamento disponíveis para toda operação de rede.
- Percentual é best-effort (parse da saída do Git).
