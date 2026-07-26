# 📘 Documento de Requisitos

## Ferramenta Git Desktop (Windows)

---

## 1. 📌 Visão Geral

### 1.1 Objetivo

Desenvolver uma aplicação desktop para Windows que permita o gerenciamento de repositórios Git de forma visual, intuitiva e eficiente, oferecendo recursos equivalentes ou superiores aos encontrados em ferramentas como Fork e GitKraken.

### 1.2 Público-Alvo

* Desenvolvedor único (uso pessoal)
* Possível expansão futura para times pequenos

### 1.3 Motivação

* Controle total sobre funcionalidades
* Melhor gerenciamento de múltiplas identidades Git (nome/email)
* Customização de fluxo de trabalho
* Independência de ferramentas pagas

---

## 2. 🎯 Escopo

### 2.1 Escopo Incluído

* Interface gráfica para operações Git
* Gerenciamento de múltiplos repositórios
* Gerenciamento de múltiplas credenciais (nome/email)
* Integração com serviços remotos (GitHub, GitLab, Bitbucket)
* Visualização de histórico (graph)
* Resolução de conflitos

### 2.2 Escopo Excluído (Inicial)

* Mobile
* Colaboração em tempo real
* Code review avançado (PR UI completo)

---

## 3. 🧱 Arquitetura (Visão Inicial)

### 3.1 Stack Sugerida

* **Frontend Desktop:** Electron ou Tauri
* **UI:** React + TypeScript
* **State Management:** Zustand
* **Validação:** Zod
* **Estilização:** TailwindCSS
* **Backend Local:** Node.js (opcional)
* **Git Engine:** CLI Git + wrapper (simple-git ou isomorphic-git)
* **Armazenamento:** SQLite ou IndexedDB

---

## 4. ⚙️ Requisitos Funcionais

### 4.1 Gerenciamento de Repositórios

* RF001: Clonar repositórios remotos
* RF002: Inicializar novos repositórios
* RF003: Abrir múltiplos repositórios simultaneamente
* RF004: Listar repositórios recentes
* RF005: Detectar mudanças automaticamente

---

### 4.2 Controle de Versionamento

* RF006: Stage/Unstage arquivos
* RF007: Commit com mensagem
* RF008: Amend commit
* RF009: Reset (soft, mixed, hard)
* RF010: Stash (create, apply, drop)
* RF011: Cherry-pick
* RF012: Rebase (interativo e automático)
* RF013: Merge branches

---

### 4.3 Branches e Histórico

* RF014: Criar/Excluir branches
* RF015: Checkout de branches
* RF016: Visualização gráfica (commit tree)
* RF017: Filtrar commits
* RF018: Buscar histórico por autor/data

---

### 4.4 Integração com Remotos

* RF019: Adicionar/remover remotes
* RF020: Push/Pull
* RF021: Fetch automático/manual
* RF022: Gerenciar upstream branches
* RF023: Autenticação (HTTPS/SSH)

---

### 4.5 🔑 Gerenciamento de Múltiplas Credenciais (Feature Principal)

* RF024: Cadastro de múltiplos perfis Git

  * Nome
  * Email
  * Chave SSH associada (opcional)

* RF025: Associar perfil a repositório específico

* RF026: Troca automática de identidade por projeto

* RF027: Override manual por commit

* RF028: Visualização clara da identidade ativa

* RF029: Suporte a múltiplas contas (GitHub, GitLab, etc.)

* RF030: Armazenamento seguro das credenciais

---

### 4.6 Conflitos e Diferenças

* RF031: Diff visual (lado a lado)
* RF032: Highlight de mudanças
* RF033: Editor de conflitos integrado
* RF034: Aceitar/rejeitar mudanças

---

### 4.7 Interface do Usuário

* RF035: Tema claro/escuro
* RF036: Layout com abas
* RF037: Navegação rápida entre repositórios
* RF038: Feedback visual de operações
* RF039: Logs detalhados

---

### 4.8 Automação e Produtividade

* RF040: Hooks Git (pré-configuração)
* RF041: Execução de scripts
* RF042: Alias de comandos
* RF043: Integração com terminal embutido

---

## 5. 🧩 Requisitos Não Funcionais

### 5.1 Performance

* RNF001: Operações Git devem ser executadas em background
* RNF002: UI deve responder em < 100ms para interações básicas

### 5.2 Segurança

* RNF003: Criptografia de credenciais
* RNF004: Isolamento de perfis
* RNF005: Não expor tokens sensíveis

### 5.3 Usabilidade

* RNF006: UX simples e intuitiva
* RNF007: Curva de aprendizado baixa
* RNF008: Atalhos de teclado

### 5.4 Confiabilidade

* RNF009: Logs detalhados
* RNF010: Recuperação de falhas (rollback seguro)

---

## 6. 🖥️ Casos de Uso Principais

### UC01 - Clonar Repositório

1. Usuário informa URL
2. Seleciona credencial
3. Define diretório
4. Sistema clona repositório

---

### UC02 - Commit com Identidade Específica

1. Usuário altera arquivos
2. Abre tela de commit
3. Seleciona perfil (nome/email)
4. Realiza commit

---

### UC03 - Troca Automática de Credencial

1. Usuário abre repositório
2. Sistema identifica perfil associado
3. Aplica automaticamente identidade

---

## 7. 📊 Modelo de Dados (Simplificado)

### Entidade: GitProfile

* id
* name
* email
* sshKeyPath
* provider (GitHub, GitLab, etc.)

### Entidade: Repository

* id
* name
* path
* defaultProfileId

---

## 8. 🚀 Roadmap (Sugestão)

### MVP

* Clone / Commit / Push / Pull
* Múltiplas credenciais
* Histórico simples

### V1

* Graph completo
* Diff avançado
* Merge/Rebase UI

### V2

* Automação (hooks/scripts)
* Performance tuning
* Plugins

---

## 9. 🧠 Diferenciais da Ferramenta

* Foco em múltiplas identidades (melhor que concorrentes)
* UX simplificada
* Customização avançada
* Controle total local (sem dependência cloud)

---

## 10. 📌 Considerações Finais

Este projeto pode evoluir de uma ferramenta pessoal para um produto SaaS no futuro. A base arquitetural deve priorizar modularidade, extensibilidade e performance.

---
