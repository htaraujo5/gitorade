# Roadmap — Gitorade

Documento vivo. Fonte de verdade para fases, critérios de aceite e decisões vigentes.

## Visão

Aplicativo desktop Windows local-first para Git, com **múltiplas identidades** (nome/email/SSH) como diferencial central.

## Stack vigente

| Área | Escolha |
|------|---------|
| Shell | Tauri 2 |
| UI | React + TypeScript + Vite |
| Estado UI | Zustand |
| Validação | Zod |
| Estilo | TailwindCSS + tokens do styleguide |
| Git | CLI Git via adapter Rust |
| Persistência | SQLite (backend) |
| Segredos | Windows Credential Manager / SSH Agent / GCM |

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

- [ ] Histórico paginado + graph inicial
- [ ] Branches (criar/trocar/renomear/excluir)
- [ ] Stash + ahead/behind

**Aceite:** MVP funcional completo.

### Fase 4 — Hardening MVP

- [ ] Testes de integração, a11y, performance
- [ ] Instalador MSI/NSIS, release versionada

**Aceite:** MVP distribuível confiável.

### V1 / V2

Ver plano detalhado em `../.cursor/plans` / documentação de escopo. Graph avançado, conflitos, rebase, hooks e plugins ficam pós-MVP.
