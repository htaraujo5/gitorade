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

- `bundle/nsis/Gitorade_0.1.0_x64-setup.exe` — instalador estilo GitKraken
- `bundle/msi/Gitorade_0.1.0_x64_en-US.msi`

Na primeira execução, o app abre uma janela compacta (nome, email, pasta de projetos) e depois expande para o dashboard.

Release automatizado: tag `v*` dispara `.github/workflows/release.yml`.

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run tauri dev` | App desktop em modo dev |
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
