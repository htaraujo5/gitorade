# Roadmap — Gitorade

Documento vivo. Fonte de verdade para fases, critérios de aceite e decisões vigentes.

## Visão

Aplicativo desktop Windows local-first para Git, com **múltiplas identidades** (nome/email/SSH) como diferencial central.

## Stack vigente

| Área         | Escolha                                      |
| ------------ | -------------------------------------------- |
| Shell        | Tauri 2                                      |
| UI           | React + TypeScript + Vite                    |
| Estado UI    | Zustand                                      |
| Validação    | Zod                                          |
| Estilo       | TailwindCSS + tokens do styleguide           |
| Git          | CLI Git via adapter Rust                     |
| Persistência | SQLite (backend)                             |
| Segredos     | Windows Credential Manager / SSH Agent / GCM |

## Fases

### Fase 0 — Fundação

- [x] Scaffold Tauri/React/TypeScript
- [x] ADRs (shell, Git, storage, segurança, UI template)
- [x] Design tokens + layout base (alinhado a `template.png` / `ui-layout.md`)
- [x] SQLite + migrations
- [x] Detecção de pré-requisitos (Git) via `get_app_health`
- [x] Git init local
- [x] Lint, testes frontend, `cargo test`, build desktop debug
- [x] CI workflow Windows (`.github/workflows/ci.yml`)

**Aceite:** app abre no Windows e executa uma chamada backend tipada. ✅

**UI:** shell do template — sidebar (repos/favoritos/config), header + toolbar, tabs Graph/Commits/Changes/Files, painel direito Changes/Credentials.

### Fase 1 — Fatia vertical

- [x] Abrir/adicionar repositório, recentes/favoritos
- [x] Status + refresh periódico
- [x] Stage/unstage, diff textual, commit
- [x] CRUD de perfis + associação por repo + override por commit
- [x] Brand oficial (`logo.png` / `brand.png`) no shell

**Aceite:** fluxo abrir → revisar → identidade → commit.

### Fase 2 — Remotos

- [x] Clone/init, remotes (add/remove/list)
- [x] Fetch/pull/push com progresso (evento `git://progress`) e cancelamento
- [x] Autenticação via SSH Agent / GCM (sem prompt interativo, `GIT_TERMINAL_PROMPT=0`)
- [x] Redaction de tokens em logs/erros de streaming

**Aceite:** uso diário básico com remoto. ✅

### Fase 3 — Histórico e branches

- [x] Histórico paginado + graph inicial (lanes + busca)
- [x] Branches (criar/trocar/renomear/excluir local)
- [x] Stash (push/apply/pop/drop)
- [x] Ahead/behind no status e no header

**Aceite:** MVP funcional completo. ✅

### Fase 4 — Hardening MVP

- [x] Testes de integração Rust contra repositórios git temporários (`src-tauri/tests/git_integration.rs`)
- [x] Correção de edge case: unstage em branch sem commit (HEAD não resolvível)
- [x] Acessibilidade: foco de teclado (`:focus-visible`), `aria-label`/landmarks, `role` de dialog/progressbar/toolbar, `prefers-reduced-motion`, atalho Ctrl/Cmd+Enter para commit
- [x] Performance: brand assets reduzidos de ~2 MB para ~6–16 KB (bundle ~4,5 MB → ~350 KB)
- [x] Instalador MSI/NSIS + metadados de produto (`tauri.conf.json` bundle)
- [x] Workflow de release versionada (`.github/workflows/release.yml`, disparo por tag `v*`)
- [x] ADR de hardening (`adr/0008-hardening-mvp.md`)

**Aceite:** MVP distribuível confiável. ✅

### V1 — Diff avançado e integração

- [x] Diff lado a lado (parse unificado → split) com toggle unificado/split
- [x] Merge de branch na atual (`merge_branch`)
- [x] Rebase onto (não-interativo)
- [x] Cherry-pick a partir do graph
- [x] Detecção de conflitos no status (`inProgress` + `conflicts`)
- [x] UI de resolução: ours / theirs / edição manual + continuar / abortar
- [x] Testes de integração de merge/conflito/cherry-pick/rebase

**Aceite:** fluxos diários de integração sem sair do app. ✅

### V1.1 — Security hardening

- [x] `path_guard` + containment em conflict/stage/diff/history (SEC-01/02/09)
- [x] Validação de `ssh_key_path` / sem injeção em `GIT_SSH_COMMAND` (SEC-03)
- [x] CSP restritiva no Tauri (SEC-04)
- [x] Guards de argv/URL em clone/remotes/refs (SEC-07)
- [x] Askpass com token + pending map; host key `yes` (SEC-06/08)
- [x] `redact_secrets` ampliado (SEC-11)
- [x] Terminal desligável + kill ao trocar repo (SEC-05)
- [x] `confirmDangerous` aplicado nas ações destrutivas (SEC-12)
- [x] Opener allowlist GitHub HTTPS (SEC-13)
- [x] Sem `--textconv` em `file_at_commit` (SEC-10)
- [x] ssh-agent via `sc.exe` (SEC-14)
- [x] CI audit job + Release environment (SEC-15)
- [ ] Authenticode signing (SEC-16 — quando houver certificado)
- [x] ADR 0010

**Aceite:** bloqueadores Critical/High remedidos; CI + docs atualizados.

### Redesign de shell (layout mockups)

- [x] Fonte de verdade: `documentacao/layout/` (ADR 0005 atualizado)
- [x] Sidebar de app (Dashboard / Repos / Favoritos / Histórico + Config)
- [x] Dashboard home (busca, favoritos, recentes, Ctrl+P)
- [x] Header com dropdowns projeto/branch
- [x] Changes em 3 colunas; Credenciais full-page
- [x] Graph com painel de detalhes do commit (`get_commit_files`)

### V2

Automação (hooks/scripts), performance tuning e plugins — ver `escopo.md`.
