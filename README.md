# Gitorade

Cliente Git desktop para **Windows**, **macOS** e **Linux** — local-first, com múltiplas identidades como diferencial.

> Seu Git. Seu fluxo. Seu jeito.

## Stack

- Tauri 2 + React + TypeScript + Vite
- Zustand · Zod · TailwindCSS
- Git CLI (adapter Rust) · SQLite

## Pré-requisitos

### Windows

- Node.js 22+
- Rust (stable) + **MSVC Build Tools** (workload C++ / `link.exe`)
- Git for Windows
- Visual Studio 2022/2026 com “Desenvolvimento para desktop com C++”, ou Build Tools equivalentes

Se `cargo` falhar com `linker link.exe not found`, instale as ferramentas C++ e abra um novo terminal.

### macOS

- Node.js 22+
- Rust (stable)
- Xcode Command Line Tools (`xcode-select --install`)
- Git (vem com as CLT ou via Homebrew)

### Linux (Debian/Ubuntu)

- Node.js 22+
- Rust (stable)
- Git (`sudo apt install git`)
- Dependências Tauri / WebKitGTK (dev):

```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev \
  librsvg2-dev patchelf
```

## Desenvolvimento

```bash
npm install
npm run tauri dev
```

## Instaladores

Gera artefatos em `src-tauri/target/release/bundle/` conforme o SO:

```bash
npm run dist
```

### Windows

- `bundle/nsis/Gitorade_*_x64-setup.exe` — instalador recomendado (banners do logo)
- `bundle/msi/Gitorade_*_x64_*.msi`

O instalador NSIS usa `icons/nsis/sidebar.bmp` + `header.bmp` (gere com `npm run icons` antes do `npm run dist`).

### macOS

- `bundle/dmg/Gitorade_*.dmg` — arraste o app para Applications
- Atalho: `npm run dist:mac` (só o DMG)

No macOS a barra de título usa o estilo **Overlay** do sistema (traffic lights nativos integrados ao chrome do app).

### Linux

- `bundle/deb/gitorade_*.deb` — Debian/Ubuntu (`sudo dpkg -i …`)
- Requer Git no PATH após instalar

Na primeira execução: splash → setup (nome/email/pasta) → dashboard.

### Release automático (GitHub Actions)

Workflow [`.github/workflows/release.yml`](.github/workflows/release.yml):

1. Atualiza a versão (`package.json`, `Cargo.toml`, `tauri.conf.json`)
2. Compila instaladores **Windows** (NSIS + MSI), **macOS** (`.dmg` arm64 + x64) e **Linux** (`.deb`)
3. Publica em **GitHub → Releases**

**Bump de versão**

| Tipo      | O que muda            | Exemplo           |
| --------- | --------------------- | ----------------- |
| `fix`     | último número (patch) | `1.0.0` → `1.0.1` |
| `hotfix`  | do meio (minor)       | `1.0.1` → `1.1.0` |
| `release` | o primeiro (major)    | `1.1.0` → `2.0.0` |

**Como disparar**

- Manual: Actions → **Release** → Run workflow → escolha `fix` / `hotfix` / `release`
- Automático no push em `main`/`master` se os commits desde a última tag tiverem prefixo:
  - `fix: ...` → patch
  - `hotfix: ...` ou `feat: ...` → minor
  - `release: ...` ou `BREAKING CHANGE` → major

O CI (`.github/workflows/ci.yml`) só valida lint/testes/`cargo check` — **não** gera instalador (isso evita o Actions quebrar em build longo a cada PR).

> Não faça o bump manualmente antes do push: o workflow já aplica o bump a partir do prefixo
> do commit. Rodar o script localmente **e** dar push com `feat:` pula uma versão.

```bash
node scripts/bump-version.mjs print    # versão atual
node scripts/bump-version.mjs detect   # bump sugerido pelo git log
node scripts/bump-version.mjs fix      # aplica patch localmente
```

### Atualização dentro do app (2.0.5+)

O Gitorade consulta a release mais recente do GitHub (`/releases/latest`) ao iniciar
(desligável em **Preferências → Sobre**) e em **Ajuda → Verificar atualizações**. Ao aceitar:

| SO      | O que acontece                                                                              |
| ------- | ------------------------------------------------------------------------------------------- |
| Linux   | baixa o `_amd64.deb` e instala com `pkexec apt-get install` (pede a senha), depois reinicia |
| Windows | baixa o `-setup.exe` (NSIS), abre o instalador e fecha o app                                |
| macOS   | baixa o `.dmg` da arquitetura e abre para arrastar para Applications                        |

- O download só é aceito de `github.com/htaraujo5/gitorade/releases/download/…` e é verificado
  pelo `sha256` que o GitHub publica para cada asset.
- No Linux a instalação automática só roda se o app veio do `.deb` (binário em `/usr`); caso
  contrário o modal mostra o comando `sudo apt install …` com o arquivo baixado.
- Builds de desenvolvimento (`npm run tauri dev`) não se atualizam.
- Os nomes de asset que o updater procura são os gerados pelo `release.yml`
  (`Gitorade_<versão>_x64-setup.exe`, `Gitorade_<versão>_amd64.deb`,
  `Gitorade_<versão>_{aarch64,x64}.dmg`) — mantenha-os se mexer no workflow.

Quem está na 2.0.4 ou anterior precisa instalar a 2.0.5 manualmente uma vez; a partir dela o app
avisa sozinho.

### Snap Store (App Center do Ubuntu)

Receita em [`snap/snapcraft.yaml`](snap/snapcraft.yaml) (confinamento `strict`, extensão `gnome`,
Git e OpenSSH empacotados dentro do snap). A versão vem do `package.json`.

Configuração única:

```bash
sudo snap install snapcraft --classic
snapcraft login                      # conta Ubuntu One
snapcraft register gitorade          # reserva o nome
snapcraft export-login --snaps=gitorade \
  --acls package_access,package_push,package_update,package_release -
```

Cole a saída do `export-login` no secret **`SNAPCRAFT_STORE_CREDENTIALS`** (Settings → Environments →
`release`). A partir daí o job `snap` do `release.yml` publica cada release no canal `stable`; sem
o secret o job só registra um aviso e é pulado.

Build e teste local:

```bash
snapcraft                                  # usa LXD; na 1ª vez: sudo snap install lxd && sudo lxd init --auto
sudo snap install ./gitorade_*.snap --dangerous
sudo snap connect gitorade:ssh-keys        # acesso a ~/.ssh (não conecta sozinho)
snap run gitorade
```

Limitações do confinamento `strict`:

- O app só enxerga a home (sem arquivos ocultos) e mídias removíveis; repositórios em outros
  lugares (ex.: `/opt`, `/srv`) não abrem.
- `~/.ssh` exige `snap connect gitorade:ssh-keys` (ou pedir auto-connect no
  [fórum do Snapcraft](https://forum.snapcraft.io/c/store-requests/19)).
- O Git usado é o do snap, com `HOME` isolado: o `~/.gitconfig` do usuário não é lido (a identidade
  vem dos perfis do Gitorade).
- O terminal integrado roda dentro do snap e não vê as ferramentas instaladas no sistema.
- O updater interno fica desligado; a Snap Store atualiza sozinha (`sudo snap refresh gitorade`).

## Scripts

| Comando             | Descrição                                                                     |
| ------------------- | ----------------------------------------------------------------------------- |
| `npm run tauri dev` | App desktop em modo dev                                                       |
| `npm run icons`     | Regenera logos, ícones Windows e banners NSIS                                 |
| `npm run dist`      | Build release + instaladores (Windows: MSI/NSIS · macOS: DMG · Linux: `.deb`) |
| `npm run dist:mac`  | Build `.app` + DMG via `hdiutil` (macOS)                                      |
| `npm run build`     | Build do frontend                                                             |
| `npm test`          | Testes Vitest                                                                 |
| `npm run lint`      | ESLint                                                                        |
| `npm run format`    | Prettier                                                                      |

## Site (Vercel)

Landing estática em [`website/`](website/). No deploy da Vercel, defina **Root Directory** = `website` (build vazio). O botão de download resolve a release mais recente (`.exe` no Windows, `.dmg` no macOS, `.deb` no Linux).

## Documentação

- [Escopo](documentacao/escopo.md)
- [Style guide](documentacao/styleguide.md)
- [UI layout / template](documentacao/ui-layout.md)
- [Roadmap](documentacao/roadmap.md)
- [ADRs](documentacao/adr/)
