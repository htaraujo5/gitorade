# UI Layout — Gitorade

Fonte visual: [`layout/`](./layout/) (mockups Dashboard, Histórico, Changes)  
Histórico: [`template.png`](./template.png) (referência antiga)  
Tokens: [`styleguide.md`](./styleguide.md)

## Branding

- Logo: [`logo.png`](./logo.png) / lockup [`brand.png`](./brand.png)
- Slogan: "Seu Git. Seu fluxo. Seu jeito."
- Assets em `src/assets/brand/`

## Shell (app-level)

```
+------------------+-----------------------------------------------+
| App Sidebar      | Main (muda com appView)                        |
| Dashboard        | Dashboard | Repo list | Credentials | …       |
| Repositórios     |                                               |
| Favoritos        | — ou, se Histórico + repo ativo: —            |
| Histórico        | Header (projeto + branch + toolbar)           |
| Configurações    | Tabs Graph | Commits | Changes | Branches…  |
| (perfil + ver)   | Conteúdo do workspace                         |
+------------------+-----------------------------------------------+
```

### Sidebar de app

- **Dashboard / Repositórios / Favoritos / Histórico** — navegação de produto
- **Configurações** — Credenciais (tela), SSH Keys / Preferências / Plugins / Sobre (placeholders)
- Rodapé: avatar inicial + perfil ativo + versão

### Dashboard

- Saudação, busca, Abrir / Clonar / Novo
- Cards de favoritos + lista de recentes
- Atalho Ctrl+P → abrir repositório

### Workspace (Histórico)

- Header: dropdowns de projeto e branch + toolbar Commit/Pull/Push/Fetch/Branch/Merge/Stash
- Abas: Graph · Commits · Changes · Branches · Stash

### Changes (3 colunas)

| Esquerda | Centro | Direita |
|----------|--------|---------|
| Staged / Unstaged | Diff (lado a lado / unificado) | Identidade + mensagem + Commit |

### Graph

- Lista + lanes à esquerda
- Painel direito: detalhes do commit (hash, autor, arquivos, “Ver alterações”)

## Nota

Os mockups em `documentacao/layout/` prevalecem sobre `template.png`. Cores/espaçamento seguem o styleguide.
