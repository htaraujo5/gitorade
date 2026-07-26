# UI Layout — Gitorade

Fonte visual: [`template.png`](./template.png)  
Tokens de cor/tipografia: [`styleguide.md`](./styleguide.md)

## Branding

- Logo ícone: [`logo.png`](./logo.png) — “G” + raio, gradiente violeta → magenta
- Brand lockup: [`brand.png`](./brand.png) — logo + wordmark `gitorade`
- Slogan: "Seu Git. Seu fluxo. Seu jeito."
- Tom: dark-first, denso, técnico, produto Windows
- Acentos de UI seguem o gradiente da brand (CTAs / Active), superfícies do styleguide

Assets consumidos em `src/assets/brand/` (copiados da documentação).

## Shell principal (workspace)

```
+------------------+----------------------------------------+------------------+
| Sidebar          | Header (repo + branch + toolbar)       |                  |
|                  +----------------------------------------+                  |
| Repositórios     | Tabs: Graph | Commits | Changes | Files| Painel direito  |
| Favoritos        |                                        | Changes /        |
| Configurações    | Conteúdo principal (graph/lista)       | Credentials      |
|                  |                                        | Commit box       |
+------------------+----------------------------------------+------------------+
```

### Sidebar

- **Repositórios** — lista de projetos abertos/recentes
- **Favoritos** — atalho
- **Configurações** — Credenciais, SSH Keys, Preferências, Plugins, About

### Header

- Nome do repositório ativo + branch atual
- Toolbar: Commit · Pull · Push · Fetch · Branch · Merge · Stash

### Main

- Abas: **Graph**, **Commits**, **Changes**, **Files**
- Graph: linhas coloridas por branch + lista de commits (badge de branch, mensagem, autor, hash, tempo relativo)

### Painel direito

- **Changes:** Staged / Unstaged com checkboxes; mensagem de commit; botão Commit (+ opções)
- **Credentials:** perfis (nome, provider), badge Active, gerenciar perfis globais
- Identidade ativa sempre visível (diferencial do produto)

## Módulos detalhados (pós-MVP / V1)

| Módulo | Papel |
|--------|--------|
| Diff viewer | Lado a lado; remoções vermelho / adições verde |
| Branches | Local/Remote, search, ahead/behind, Checkout/Merge |
| Stash | Lista com descrição e timestamp |
| About / splash | Branding + versão |

## Mapeamento por fase

| Elemento UI | Fase |
|-------------|------|
| Shell (sidebar + header + tabs) | 0–1 |
| Changes + commit + credentials panel | 1 |
| Toolbar Pull/Push/Fetch | 2 |
| Graph/Commits básico | 3 |
| Diff lado a lado, Branches, Stash ricos | 3–V1 |
| Plugins na sidebar | V2 |

## Nota de design

O layout e hierarquia do `template.png` prevalecem sobre descrições genéricas. Cores/espaçamento seguem o styleguide; onde houver conflito visual óbvio com o template, alinhar ao template e ajustar tokens.
