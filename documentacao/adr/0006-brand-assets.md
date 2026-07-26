# ADR 0006 — Brand assets oficiais

## Status

Accepted

## Context

Foram adicionados `documentacao/logo.png` (ícone G+raio) e `documentacao/brand.png` (lockup), além do `template.png` como documentação visual.

## Decision

- Logo/brand oficiais vivem em `documentacao/` e são copiados para `src/assets/brand/` para o app.
- Gradiente violeta → magenta da brand é o accent principal de CTAs.
- Layout de telas segue `template.png` / `ui-layout.md`.

## Consequences

- Shell usa `BrandMark` com assets reais (não SVG placeholder).
- Styleguide de superfícies permanece dark; accents alinhados à brand.
