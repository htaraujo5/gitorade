# ADR 0005 — UI shell baseado no template

## Status

Accepted

## Context

Foi adicionado `documentacao/template.png` como mockup da aplicação: sidebar, toolbar, graph, painel de changes/credentials, diff, branches e stash.

## Decision

Usar o template como **fonte de verdade do layout e hierarquia**.

- Tokens de cor/tipografia continuam em `styleguide.md`.
- Estrutura de telas documentada em `ui-layout.md`.
- Em conflito óbvio entre styleguide genérico e template, prevalece o template.

## Consequences

- Fase 0 entrega o shell (sidebar/header/tabs/painel direito) mesmo com dados mock.
- Features reais (Fase 1+) preenchem os painéis sem redesenhar a navegação.
