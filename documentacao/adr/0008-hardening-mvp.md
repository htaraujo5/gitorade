# ADR 0008 — Hardening do MVP (testes, a11y, performance, release)

## Status

Accepted

## Context

Concluídas as Fases 0–3, o MVP precisava ser endurecido antes de ser considerado
distribuível: confiança via testes automatizados, acessibilidade mínima,
tamanho de bundle razoável e um caminho de instalação/release reproduzível no
Windows.

## Decisão

### Testes de integração (backend)

- Suíte `src-tauri/tests/git_integration.rs` que exercita o adapter Git contra
  repositórios temporários (`tempfile`), nunca tocando o repositório do projeto.
- Cobre: detecção do Git, status (untracked → staged → unstaged), commit com
  identidade fornecida (verificando que o autor gravado é o do perfil, não o
  global), guarda de commit sem stage, ciclo de vida de branches, graph, stash
  (push/pop) e paths com espaços/unicode.
- Módulos `git`/`domain`/`error` expostos como `pub` no crate lib para permitir
  testes de integração (`tests/`).

### Correção de edge case

- `unstage` usava `git restore --staged`, que exige um `HEAD` resolvível. Em
  branch sem commit (unborn) isso falhava. Agora detectamos `HEAD` via
  `git rev-parse --verify --quiet HEAD`; sem HEAD, usamos `git rm --cached`
  (correto porque toda entrada staged nesse estado é necessariamente nova).

### Acessibilidade

- Foco de teclado visível com `:focus-visible` (sem outline para mouse).
- Landmarks (`main`, `nav`/`aside` com `aria-label`), `role="toolbar"` no header,
  `role="dialog"`+`aria-modal` no overlay de operações, `role="progressbar"` com
  `aria-valuenow`, e `aria-live` para status/logs.
- Botões só de ícone (favoritar/remover) ganharam `aria-label` e `aria-hidden`
  no glifo; suporte a `prefers-reduced-motion`.
- Atalho global Ctrl/Cmd+Enter para commit; Escape fecha/cancela o overlay.

### Performance

- Assets de marca (`logo.png`, `brand.png`) eram 1536×1024 (~2 MB cada) mas
  renderizados a ~32–40 px. Redimensionados para 256/320 px de lado maior,
  reduzindo o bundle de ~4,5 MB para ~350 KB, sem perda perceptível.

### Instalação e release

- `tauri.conf.json`: targets `msi` + `nsis`, metadados (publisher, copyright,
  categoria, descrições) e NSIS `installMode: currentUser` (sem exigir admin).
- `.github/workflows/release.yml`: disparo por tag `v*` (ou manual), usa
  `tauri-apps/tauri-action` para gerar instaladores e publicar um GitHub Release
  em rascunho.

## Consequências

- Regressões no núcleo Git são detectadas em CI de forma determinística.
- App instalável por usuário comum e com bundle enxuto.
- Acessibilidade básica cobre navegação por teclado e leitores de tela; auditoria
  completa (contraste AAA, testes com NVDA) fica para pós-MVP.
