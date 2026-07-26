# ADR 0005 — UI shell baseado nos mockups de layout

## Status

Accepted (supersedes template-only approach)

## Context

O shell inicial foi alinhado a `documentacao/template.png`. Em seguida foram
adicionados mockups detalhados em `documentacao/layout/` (Dashboard, Histórico,
Changes em 3 colunas, Credenciais full-page) que definem outra navegação de
produto — app-level sidebar em vez de lista de repos na barra lateral.

## Decision

- Fonte de verdade do layout: **`documentacao/layout/`**
- Documentação estrutural: `ui-layout.md`
- `template.png` permanece como referência histórica / moodboard
- Em conflito óbvio entre styleguide e layout mockups, prevalece o layout

## Consequences

- Shell React roteia por `appView` (dashboard, history, credentials, …)
- Painel direito fixo Changes/Credentials foi removido; Changes vive em 3 colunas
  no workspace; Credenciais é tela dedicada
- Preferências / SSH / Plugins ficam como placeholders até V2
