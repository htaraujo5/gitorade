# 🎨 Style Guide — Git Desktop Application

Referência visual de layout: [`template.png`](./template.png) · estrutura: [`ui-layout.md`](./ui-layout.md)

---

## 1. 🧭 Princípios de Design

### 1.1 Filosofia

- **Clareza acima de tudo**
- **Minimizar carga cognitiva**
- **Feedback imediato**
- **Controle total ao usuário**
- **Visual limpo + poder avançado**

### 1.2 Inspirações

- Fork → simplicidade e performance
- GitKraken → visual moderno e feedback visual
- VS Code → consistência e extensibilidade

---

## 2. 🎨 Identidade Visual

### 2.1 Personalidade da Interface

- Técnica, porém amigável
- Moderna, minimalista
- Focada em produtividade

### 2.2 Tom Visual

- Escuro como padrão (Dark First)
- Contraste equilibrado
- Uso inteligente de cores sem poluição

---

## 3. 🌈 Paleta de Cores

### 3.1 Cores Base (Dark Theme)

| Tipo                 | Cor     | Uso                   |
| -------------------- | ------- | --------------------- |
| Background Primary   | #0D1117 | Fundo principal       |
| Background Secondary | #161B22 | Cards / painéis       |
| Surface              | #21262D | Elementos interativos |
| Border               | #30363D | Divisões              |

---

### 3.2 Cores Primárias

| Nome          | Cor     | Uso              |
| ------------- | ------- | ---------------- |
| Primary       | #2F81F7 | Ações principais |
| Primary Hover | #1F6FEB | Hover            |
| Accent        | #58A6FF | Destaques        |

---

### 3.3 Cores Semânticas

| Tipo    | Cor     | Uso            |
| ------- | ------- | -------------- |
| Success | #238636 | Commit sucesso |
| Danger  | #DA3633 | Erros          |
| Warning | #D29922 | Alertas        |
| Info    | #1F6FEB | Informação     |

---

### 3.4 Cores Git (IMPORTANTE)

| Elemento          | Cor     |
| ----------------- | ------- |
| Branch atual      | #2F81F7 |
| Branch secundária | #A371F7 |
| Merge             | #238636 |
| Rebase            | #D29922 |
| Commit normal     | #8B949E |

---

## 4. 🔤 Tipografia

### 4.1 Fontes

- **Primária:** Inter
- **Monoespaçada:** JetBrains Mono

---

### 4.2 Escala Tipográfica

| Tipo  | Tamanho | Peso |
| ----- | ------- | ---- |
| H1    | 24px    | 600  |
| H2    | 20px    | 600  |
| H3    | 16px    | 500  |
| Body  | 14px    | 400  |
| Small | 12px    | 400  |
| Code  | 13px    | 400  |

---

### 4.3 Uso

- Código sempre monoespaçado
- Mensagens importantes em semibold
- Labels em uppercase leve

---

## 5. 📐 Espaçamento & Grid

### 5.1 Sistema Base

- Base unit: **8px**

### 5.2 Escala

- 4px → micro espaçamento
- 8px → padrão
- 16px → seções
- 24px → separação grande

---

### 5.3 Layout

- Sidebar fixa
- Área principal fluida
- Painéis redimensionáveis

---

## 6. 🧩 Componentes

---

### 6.1 Botões

#### Tipos

- Primary
- Secondary
- Ghost
- Danger

#### Estilo

**Primary**

- Background: Primary
- Texto: branco
- Border-radius: 6px
- Padding: 8px 12px

**Ghost**

- Sem fundo
- Hover com leve highlight

---

### 6.2 Inputs

- Background: Surface
- Border: 1px solid Border
- Focus: borda Primary
- Radius: 6px

---

### 6.3 Dropdowns

- Fundo escuro
- Hover highlight
- Ícones opcionais

---

### 6.4 Tabs

- Linha inferior ativa
- Animação suave
- Destaque de aba ativa

---

### 6.5 Modais

- Overlay escuro (opacity 0.6)
- Fundo Surface
- Cantos arredondados (8px)

---

## 7. 📊 Componentes Git Específicos

---

### 7.1 Commit Graph

- Linhas coloridas por branch
- Nós (commits):

  - círculo preenchido
  - tamanho: 8px

- Hover:

  - mostra detalhes
  - highlight

---

### 7.2 Diff Viewer

- Lado a lado
- Cores:

  - Adição → verde
  - Remoção → vermelho

- Highlight por linha

---

### 7.3 File Status

| Status   | Cor     |
| -------- | ------- |
| Modified | #D29922 |
| Added    | #238636 |
| Deleted  | #DA3633 |

---

## 8. 🧠 UX (Experiência do Usuário)

---

### 8.1 Feedback

- Loading → spinner discreto
- Sucesso → toast verde
- Erro → toast vermelho + ação

---

### 8.2 Atalhos

- Ctrl + P → abrir repo
- Ctrl + Shift + F → buscar
- Ctrl + Enter → commit

---

### 8.3 Estados

- Empty state → instrução clara
- Error state → ação sugerida
- Loading → skeleton UI

---

## 9. 🧭 Navegação

---

### 9.1 Estrutura

- Sidebar:

  - Repositórios
  - Favoritos
  - Configurações

- Main:

  - Graph
  - Changes
  - History
  - Branches

---

## 10. 🔐 Gerenciamento de Credenciais (UX CRÍTICO)

---

### 10.1 Exibição

- Avatar + Nome + Email visível
- Badge indicando perfil ativo

---

### 10.2 Troca de Perfil

- Dropdown rápido
- Preview antes de confirmar

---

### 10.3 Segurança

- Nunca exibir tokens
- Mostrar apenas alias

---

## 11. 🌙 Temas

---

### 11.1 Dark (default)

### 11.2 Light (opcional)

- Mesmo sistema de cores adaptado

---

## 12. ⚡ Animações

- Transições: 150ms–250ms
- Ease-in-out
- Hover suave
- Evitar excesso

---

## 13. 🧱 Design System (Tokens)

```ts
export const theme = {
  colors: {
    bg: "#0D1117",
    surface: "#161B22",
    primary: "#2F81F7",
    success: "#238636",
    danger: "#DA3633",
  },
  spacing: [4, 8, 16, 24],
  radius: {
    sm: 6,
    md: 8,
  },
};
```

---

## 14. 🧪 Acessibilidade

- Contraste mínimo AA
- Navegação por teclado
- Focus visível
- Labels claros

---

## 15. 🚀 Guidelines de Código (UI)

- Componentes desacoplados
- Uso de hooks
- Evitar lógica na UI
- Reutilização máxima

---

## 16. 📌 Boas Práticas

- Nunca esconder estado importante
- Sempre mostrar o que vai acontecer
- Evitar ações destrutivas sem confirmação
- Priorizar legibilidade

---

## 17. 🧠 Diferenciais do Produto

- Visual moderno + técnico
- Clareza extrema de estado Git
- Multi-credenciais como feature central
- Performance visual

---

## 18. 🔚 Conclusão

Este Style Guide estabelece uma base sólida para uma aplicação desktop de nível profissional, garantindo consistência visual, alta usabilidade e escalabilidade.

---
