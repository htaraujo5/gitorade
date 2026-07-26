# ADR 0009 — Diff lado a lado e operações de integração

## Status

Accepted

## Context

O MVP tinha diff unificado textual e branches CRUD, mas faltavam merge/rebase/
cherry-pick e um viewer de diff mais útil para revisões.

## Decision

### Diff

- Parser puro no frontend (`src/lib/diffParse.ts`) transforma o unified diff do
  Git em linhas anotadas e em pares lado a lado (dels alinhados com adds).
- UI (`DiffViewer`) oferece toggle **Lado a lado** / **Unificado**; default é
  split. Sem mudança no backend — `git diff` continua devolvendo texto unificado.

### Integração (merge / rebase / cherry-pick)

- Novo módulo Rust `git/integrate.rs` encapsula operações não-interativas.
- Conflitos são tratados como resultado esperado (exit ≠ 0 com "conflict"), não
  como erro fatal: retorna `IntegrateResult { success: false, state }`.
- Status do repo expõe `inProgress` (`merge`|`rebase`|`cherry-pick`) e
  `conflicts[]` para a UI reagir.
- Resolução: `ours` / `theirs` via `git checkout --ours|--theirs` + stage, ou
  `content` gravando o arquivo e fazendo stage.
- Continue/abort usam `GIT_EDITOR=true` para evitar prompt de editor em Windows.

## Consequences

- Usuário resolve conflitos dentro do Gitorade sem CLI.
- Rebase interativo (todo/edit) permanece fora do escopo V1.
- Diff split é client-side; arquivos muito grandes podem precisar de virtualização
  no futuro (V2).
