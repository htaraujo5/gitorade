# Gitorade

Cliente Git desktop para Windows — local-first, com múltiplas identidades como diferencial.

> Seu Git. Seu fluxo. Seu jeito.

## Stack

- Tauri 2 + React + TypeScript + Vite
- Zustand · Zod · TailwindCSS
- Git CLI (adapter Rust) · SQLite

## Pré-requisitos

- Node.js 22+
- Rust (stable) + **MSVC Build Tools** (workload C++ / `link.exe`)
- Git for Windows
- Visual Studio 2022/2026 com “Desenvolvimento para desktop com C++”, ou Build Tools equivalentes

Se `cargo` falhar com `linker link.exe not found`, instale as ferramentas C++ e abra um novo terminal.

## Desenvolvimento

```bash
npm install
npm run tauri dev
```

## Instalador (Windows)

Gera MSI e NSIS (`.exe`) em `src-tauri/target/release/bundle/`:

```bash
npm run dist
```

Arquivos típicos:

- `bundle/nsis/Gitorade_0.1.0_x64-setup.exe` — instalador com banners do logo
- `bundle/msi/Gitorade_0.1.0_x64_en-US.msi`

Na primeira execução: splash estilo Fork → setup (nome/email/pasta) → dashboard.

O instalador NSIS usa `icons/nsis/sidebar.bmp` + `header.bmp` (gere com `npm run icons` antes do `npm run dist`).

### Release automático (GitHub Actions)

Workflow [`.github/workflows/release.yml`](.github/workflows/release.yml):

1. Atualiza a versão (`package.json`, `Cargo.toml`, `tauri.conf.json`)
2. Compila e gera instaladores Windows
3. Publica em **GitHub → Releases** (NSIS + MSI)

**Bump de versão**

| Tipo | O que muda | Exemplo |
|------|------------|---------|
| `fix` | último número (patch) | `1.0.0` → `1.0.1` |
| `hotfix` | do meio (minor) | `1.0.1` → `1.1.0` |
| `release` | o primeiro (major) | `1.1.0` → `2.0.0` |

**Como disparar**

- Manual: Actions → **Release** → Run workflow → escolha `fix` / `hotfix` / `release`
- Automático no push em `main`/`master` se os commits desde a última tag tiverem prefixo:
  - `fix: ...` → patch
  - `hotfix: ...` ou `feat: ...` → minor
  - `release: ...` ou `BREAKING CHANGE` → major

O CI (`.github/workflows/ci.yml`) só valida lint/testes/`cargo check` — **não** gera instalador (isso evita o Actions quebrar em build longo a cada PR).

```bash
node scripts/bump-version.mjs print    # versão atual
node scripts/bump-version.mjs detect   # bump sugerido pelo git log
node scripts/bump-version.mjs fix      # aplica patch localmente
```

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run tauri dev` | App desktop em modo dev |
| `npm run icons` | Regenera logos, ícones Windows e banners NSIS |
| `npm run dist` | Build release + instaladores MSI/NSIS |
| `npm run build` | Build do frontend |
| `npm test` | Testes Vitest |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

## Documentação

- [Escopo](documentacao/escopo.md)
- [Style guide](documentacao/styleguide.md)
- [UI layout / template](documentacao/ui-layout.md)
- [Roadmap](documentacao/roadmap.md)
- [ADRs](documentacao/adr/)
