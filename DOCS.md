# MelNet — Guia de Execução Local e Deploy Gratuito

## Pré-requisitos

| Ferramenta | Versão mínima | Para quê |
|---|---|---|
| Node.js | 18+ | Servidor, Desktop, Website |
| npm | 9+ | Gerenciador de pacotes (vem com Node) |
| Go | 1.22+ | Relay UDP (opcional para dev local) |
| Docker + Docker Compose | 20+ / 2.0+ | Deploy do servidor (alternativa ao Go local) |
| Git | qualquer | Clonar o repositório |

---

## 1. Instalação

```bash
git clone https://github.com/melnet/melnet.git
cd melnet
npm install
```

O `npm install` na raiz instala as dependências de todos os pacotes via workspaces.

---

## 2. Execução Local

### 2.1 Servidor WebSocket

```bash
cd packages/server
npm run dev
```

O servidor inicia na porta `3001` (configurável via `PORT`).

Variáveis de ambiente opcionais:

| Variável | Padrão | Descrição |
|---|---|---|
| `PORT` | `3001` | Porta do WebSocket server |
| `JWT_SECRET` | `melnet-dev-secret` | Segredo para assinar tokens JWT |
| `RELAY_HOST` | `localhost` | Host do relay UDP enviado aos clientes |
| `RELAY_PORT` | `4242` | Porta do relay UDP enviada aos clientes |

### 2.2 Relay UDP (Go)

```bash
cd packages/relay-udp
go mod tidy
go run ./cmd/relay
```

O relay inicia na porta UDP `4242` (configurável via `RELAY_ADDR`).

> Se não tiver Go instalado, pode pular este passo para desenvolvimento — o app desktop e o servidor funcionam sem o relay para testes de UI e lógica de salas.

### 2.3 App Desktop (Electron + React)

Abra dois terminais:

```bash
# Terminal 1 — Renderer (Vite dev server com hot-reload)
cd packages/desktop
npm run dev:renderer

# Terminal 2 — Main process (TypeScript watch)
cd packages/desktop
npm run dev:main
```

Depois que ambos estiverem rodando:

```bash
cd packages/desktop
npm run start
```

Ou use o atalho que roda tudo junto:

```bash
cd packages/desktop
npm run dev
# Em outro terminal:
npm run start
```

O app Electron abre e conecta ao servidor em `ws://localhost:3001`.

### 2.4 Site Institucional (Astro)

```bash
cd packages/website
npm run dev
```

O site abre em `http://localhost:4321`.

### 2.5 Tudo junto (resumo rápido)

```bash
# Terminal 1 — Servidor
cd packages/server && npm run dev

# Terminal 2 — Relay UDP (opcional)
cd packages/relay-udp && go run ./cmd/relay

# Terminal 3 — Desktop
cd packages/desktop && npm run dev

# Terminal 4 — Desktop (iniciar Electron)
cd packages/desktop && npm run start

# Terminal 5 — Website
cd packages/website && npm run dev
```

---

## 3. Testes

```bash
# Servidor (94 testes)
cd packages/server
npx vitest --run

# Desktop (214 testes)
cd packages/desktop
npx vitest --run

# Todos de uma vez (da raiz)
npm run --workspace=packages/server test 2>/dev/null; \
npm run --workspace=packages/desktop test
```

---

## 4. Build de Produção

### 4.1 Servidor

```bash
cd packages/server
npm run build
npm run start
```

### 4.2 Desktop (instaladores)

```bash
cd packages/desktop
npm run dist
```

Gera em `packages/desktop/release/`:
- Windows: `MelNet Setup.exe` (NSIS)
- Linux: `melnet.deb` + `MelNet.AppImage`

> Para gerar ícones, coloque `build/icon.ico` (Windows) e `build/icon.png` (Linux, 512x512) em `packages/desktop/`.

### 4.3 Website

```bash
cd packages/website
npm run build
npm run preview  # preview local da build estática
```

Gera arquivos estáticos em `packages/website/dist/`.

### 4.4 Docker (Servidor + Relay)

```bash
# Da raiz do monorepo
docker compose up --build
```

Sobe dois containers:
- `server` → porta 3001 (WebSocket)
- `relay-udp` → porta 4242/UDP

---

## 5. Deploy Gratuito

### 5.1 Site Institucional → Netlify (grátis)

1. Crie uma conta em [netlify.com](https://netlify.com)
2. Clique em "Add new site" → "Import an existing project"
3. Conecte seu repositório GitHub
4. Configure:
   - Base directory: `packages/website`
   - Build command: `npm run build`
   - Publish directory: `packages/website/dist`
5. Deploy automático a cada push

O arquivo `packages/website/netlify.toml` já está configurado.

**Alternativa — Vercel (grátis):**

1. Crie conta em [vercel.com](https://vercel.com)
2. Importe o repositório
3. Configure:
   - Root Directory: `packages/website`
   - Framework Preset: Astro
4. Deploy automático

**Alternativa — GitHub Pages (grátis):**

```bash
cd packages/website
npm run build
# Faça push da pasta dist/ para a branch gh-pages
```

### 5.2 Servidor WebSocket → Render (grátis)

1. Crie conta em [render.com](https://render.com)
2. New → Web Service
3. Conecte o repositório GitHub
4. Configure:
   - Root Directory: `packages/server`
   - Runtime: Node
   - Build Command: `npm install && npm run build`
   - Start Command: `node dist/index.js`
   - Instance Type: Free
5. Variáveis de ambiente:
   - `PORT` = `10000` (Render usa essa porta)
   - `JWT_SECRET` = (gere um segredo forte)
   - `NODE_ENV` = `production`
   - `RELAY_HOST` = (endereço do relay, se tiver)
   - `RELAY_PORT` = `4242`

> O plano gratuito do Render hiberna após 15 min de inatividade. Para uso real, considere o plano pago ($7/mês) ou Railway.

**Alternativa — Railway (grátis com créditos):**

1. Crie conta em [railway.app](https://railway.app)
2. New Project → Deploy from GitHub
3. Selecione `packages/server` como root
4. Railway detecta Node.js automaticamente
5. Adicione as variáveis de ambiente

**Alternativa — Fly.io (grátis):**

```bash
cd packages/server
fly launch
fly deploy
```

### 5.3 Relay UDP → Fly.io (grátis)

O relay UDP precisa de suporte a UDP, o que limita as opções gratuitas. Fly.io é a melhor opção gratuita com suporte a UDP.

1. Instale o CLI: `curl -L https://fly.io/install.sh | sh`
2. Crie conta: `fly auth signup`
3. Na pasta do relay:

```bash
cd packages/relay-udp
```

4. Crie um `fly.toml`:

```toml
app = "melnet-relay"
primary_region = "gru"  # São Paulo

[build]
  dockerfile = "Dockerfile"

[[services]]
  internal_port = 4242
  protocol = "udp"

  [[services.ports]]
    port = 4242
```

5. Deploy:

```bash
fly launch --no-deploy
fly deploy
```

> O plano gratuito do Fly.io inclui 3 VMs compartilhadas. Suficiente para testes e uso leve.

**Alternativa — VPS barata:**

Se precisar de mais controle, um VPS na Oracle Cloud (Always Free) ou Hetzner (€3.79/mês) roda o Docker Compose completo:

```bash
# No VPS
git clone https://github.com/melnet/melnet.git
cd melnet
docker compose up -d
```

### 5.4 Resumo de Deploy Gratuito

| Componente | Plataforma | Plano | URL |
|---|---|---|---|
| Site | Netlify | Free | melnet.netlify.app |
| Servidor WS | Render | Free | melnet-server.onrender.com |
| Relay UDP | Fly.io | Free | melnet-relay.fly.dev |

Depois do deploy, atualize as variáveis no app desktop:
- `DEFAULT_SERVER_URL` em `AuthPage.tsx` → `wss://melnet-server.onrender.com`
- `RELAY_HOST` no servidor → endereço do Fly.io

---

## 6. Variáveis de Ambiente (Referência)

### Servidor (`packages/server`)

| Variável | Padrão | Descrição |
|---|---|---|
| `PORT` | `3001` | Porta HTTP/WebSocket |
| `JWT_SECRET` | `melnet-dev-secret` | Segredo JWT (mude em produção!) |
| `RELAY_HOST` | `localhost` | Host público do relay UDP |
| `RELAY_PORT` | `4242` | Porta pública do relay UDP |
| `NODE_ENV` | — | `production` em deploy |

### Relay UDP (`packages/relay-udp`)

| Variável | Padrão | Descrição |
|---|---|---|
| `RELAY_ADDR` | `:4242` | Endereço de escuta UDP |

---

## 7. Estrutura do Monorepo

```
melnet/
├── packages/
│   ├── desktop/       # App Electron + React
│   ├── server/        # Servidor WebSocket (Node.js)
│   ├── relay-udp/     # Relay UDP (Go)
│   └── website/       # Site institucional (Astro)
├── docker-compose.yml # Orquestração server + relay
├── package.json       # Workspaces raiz
└── DOCS.md            # Este arquivo
```
