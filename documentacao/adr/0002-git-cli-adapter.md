# ADR 0002 — Engine Git: CLI via adapter Rust

## Status

Accepted

## Context

Operações como amend, rebase, stash e hooks precisam de comportamento idêntico ao Git do usuário. `isomorphic-git` não cobre bem o conjunto MVP/V1.

## Decision

Usar o **Git CLI** instalado no sistema, encapsulado por um `GitService` em Rust.

- Argumentos passados diretamente ao processo (sem shell).
- Formatos estáveis: `status --porcelain=v2`, saídas com delimitador NUL quando aplicável.
- Interface interna estável para trocar adapter no futuro se necessário.

## Consequences

- Dependência de Git instalado (detectado na inicialização).
- Comportamento alinhado a ferramentas que o usuário já conhece.
- Parsing de saída precisa ser testado e versionado.
