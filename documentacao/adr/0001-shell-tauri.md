# ADR 0001 — Shell desktop: Tauri 2

## Status

Accepted

## Context

Precisamos de um app desktop Windows com acesso a filesystem, processos Git e credenciais do OS. As opções principais são Electron e Tauri.

## Decision

Usar **Tauri 2** com frontend React + TypeScript + Vite.

## Consequences

- Binário e instalador menores; menor consumo de memória.
- Backend nativo em Rust para Git CLI, SQLite e secrets.
- IPC tipado via commands Tauri; frontend sem acesso irrestrito ao OS.
- Requer toolchain Rust + MSVC no ambiente de desenvolvimento Windows.
