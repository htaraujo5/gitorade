# Gitorade

Cliente Git desktop para **Windows** e **Linux** — local-first, com múltiplas identidades como diferencial.

> Seu Git. Seu fluxo. Seu jeito.

## Stack

- Tauri 2 + React + TypeScript + Vite
- Zustand · Zod · TailwindCSS
- Git CLI (adapter Rust) · SQLite

## Pré-requisitos

### Windows

- Node.js 22+
- Rust (stable) + **MSVC Build Tools** (workload C++ / `link.exe`)
- Git for Windows
- Visual Studio 2022/2026 com “Desenvolvimento para desktop com C++”, ou Build Tools equivalentes

Se `cargo` falhar com `linker link.exe not found`, instale as ferramentas C++ e abra um novo terminal.

### Linux (Debian/Ubuntu)

- Node.js 22+
- Rust (stable)
- Git (`sudo apt install git`)
- Dependências Tauri / WebKitGTK (dev):

```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev \
  librsvg2-dev patchelf
```

## Desenvolvimento

```bash
npm install
npm run tauri dev
```

## Instaladores

Gera artefatos em `src-tauri/target/release/bundle/` conforme o SO:

```bash
npm run dist
```

### Windows

- `bundle/nsis/Gitorade_*_x64-setup.exe` — instalador recomendado (banners do logo)
- `bundle/msi/Gitorade_*_x64_*.msi`

O instalador NSIS usa `icons/nsis/sidebar.bmp` + `header.bmp` (gere com `npm run icons` antes do `npm run dist`).

### Linux

- `bundle/deb/gitorade_*.deb` — Debian/Ubuntu (`sudo dpkg -i …`)
- Requer Git no PATH após instalar

Na primeira execução: splash → setup (nome/email/pasta) → dashboard.

### Release automático (GitHub Actions)

Workflow [`.github/workflows/release.yml`](.github/workflows/release.yml):

1. Atualiza a versão (`package.json`, `Cargo.toml`, `tauri.conf.json`)
2. Compila instaladores **Windows** (NSIS + MSI) e **Linux** (`.deb`)
3. Publica em **GitHub → Releases**

**Bump de versão**

| Tipo      | O que muda            | Exemplo           |
| --------- | --------------------- | ----------------- |
| `fix`     | último número (patch) | `1.0.0` → `1.0.1` |
| `hotfix`  | do meio (minor)       | `1.0.1` → `1.1.0` |
| `release` | o primeiro (major)    | `1.1.0` → `2.0.0` |

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

| Comando             | Descrição                                                        |
| ------------------- | ---------------------------------------------------------------- |
| `npm run tauri dev` | App desktop em modo dev                                          |
| `npm run icons`     | Regenera logos, ícones Windows e banners NSIS                    |
| `npm run dist`      | Build release + instaladores (Windows: MSI/NSIS · Linux: `.deb`) |
| `npm run build`     | Build do frontend                                                |
| `npm test`          | Testes Vitest                                                    |
| `npm run lint`      | ESLint                                                           |
| `npm run format`    | Prettier                                                         |

## Site (Vercel)

Landing estática em [`website/`](website/). No deploy da Vercel, defina **Root Directory** = `website` (build vazio). O botão de download resolve a release mais recente (`.exe` no Windows, `.deb` no Linux).

## Documentação

- [Escopo](documentacao/escopo.md)
- [Style guide](documentacao/styleguide.md)
- [UI layout / template](documentacao/ui-layout.md)
- [Roadmap](documentacao/roadmap.md)
- [ADRs](documentacao/adr/)
