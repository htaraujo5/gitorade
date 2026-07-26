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

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run tauri dev` | App desktop em modo dev |
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
