# Documento de Design — MelNet

## Visão Geral

O MelNet é um sistema composto por três componentes principais: um aplicativo desktop multiplataforma (Windows/Linux), um servidor relay central e um site institucional. O aplicativo permite que jogadores criem e entrem em salas virtuais que simulam redes LAN locais para jogos multiplayer, com foco em segurança — o IP real dos usuários nunca é exposto. O servidor relay intermedia toda comunicação entre clientes usando túneis criptografados, e o site institucional apresenta o produto e oferece downloads.

### Decisões de Design

- **Electron.js + React** para o app desktop: ecossistema maduro, suporte multiplataforma nativo, ampla comunidade. Tauri + Svelte seria mais leve, mas Electron oferece melhor compatibilidade com APIs de rede de baixo nível necessárias para o tunelamento.
- **Node.js com WebSocket** para o servidor relay: permite comunicação bidirecional em tempo real com baixa latência, essencial para listagem de salas e chat. Para o tunelamento de pacotes de jogo, um módulo em **Go** será usado como relay UDP de alta performance.
- **WireGuard-like protocol** para tunelamento: protocolo leve, criptografia moderna (ChaCha20-Poly1305), baixa overhead. Usaremos a biblioteca `wireguard-go` como base para criar túneis ponto-a-relay.
- **SQLite** para persistência local: leve, sem servidor, ideal para preferências e histórico.
- **Astro** para o site institucional: geração estática, SEO nativo, performance excelente, suporte a componentes interativos quando necessário.

## Arquitetura

### Diagrama de Arquitetura Geral

```mermaid
graph TB
    subgraph "Cliente (App Desktop)"
        UI[React UI Layer]
        NET[Network Manager]
        FW[Firewall de Aplicação]
        TUN[Tunnel Client - WireGuard-like]
        DB[(SQLite - Banco Local)]
        UI --> NET
        NET --> FW
        FW --> TUN
        UI --> DB
    end

    subgraph "Servidor Relay Central"
        WS[WebSocket Server - Node.js]
        RM[Room Manager]
        AUTH[Auth Service]
        RL[Rate Limiter]
        RELAY[UDP Relay - Go]
        VNET[Virtual Network Manager]
        WS --> RM
        WS --> AUTH
        WS --> RL
        RM --> VNET
        VNET --> RELAY
    end

    subgraph "Site Institucional"
        ASTRO[Astro Static Site]
        CDN[CDN / Hosting]
        ASTRO --> CDN
    end

    TUN <-->|"Túnel Criptografado (UDP)"| RELAY
    NET <-->|"WebSocket (TLS)"| WS
    
    style UI fill:#F5A623,color:#1A1A1A
    style RELAY fill:#E07B00,color:#fff
    style FW fill:#FFD166,color:#1A1A1A
```

### Fluxo de Comunicação

```mermaid
sequenceDiagram
    participant C1 as Cliente A
    participant FW as Firewall App
    participant SR as Servidor Relay
    participant C2 as Cliente B

    C1->>SR: WebSocket: Autenticação
    SR-->>C1: Token JWT + IP Virtual
    C1->>SR: WebSocket: Criar/Entrar Sala
    SR-->>C1: Sala criada + Código Convite
    
    C2->>SR: WebSocket: Entrar Sala (código)
    SR-->>C2: IP Virtual atribuído
    SR-->>C1: Notificação: novo membro
    
    Note over C1,C2: Comunicação de Jogo (UDP)
    C1->>FW: Pacote de jogo
    FW->>SR: Túnel criptografado (UDP)
    SR->>C2: Relay para IP Virtual destino
    
    Note over C1,C2: IPs reais nunca são trocados
```

### Modelo de Camadas

| Camada | Responsabilidade | Tecnologia |
|--------|-----------------|------------|
| UI | Interface do usuário, temas, componentes visuais | React + CSS Modules |
| Aplicação | Lógica de negócio, gerenciamento de estado | React Context / Zustand |
| Rede | WebSocket, gerenciamento de conexão | ws (Node.js client) |
| Segurança | Firewall, filtragem de tráfego, rate limiting | Módulo nativo (N-API) |
| Tunelamento | Criação e gerenciamento de túneis criptografados | wireguard-go binding |
| Persistência | Armazenamento local de preferências e histórico | better-sqlite3 |

