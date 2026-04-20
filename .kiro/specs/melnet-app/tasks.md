# Plano de Implementação: MelNet

## Visão Geral

Implementação incremental do sistema MelNet: aplicativo desktop (Electron + React), servidor relay (Node.js WebSocket + Go UDP), e site institucional (Astro). A estrutura segue um monorepo com pacotes separados para cada componente. Cada tarefa referencia os requisitos específicos do documento de requisitos.

## Tarefas

- [ ] 1. Scaffolding do monorepo e configuração base
  - [x] 1.1 Criar estrutura do monorepo com workspaces
    - Inicializar repositório com `package.json` raiz usando npm/yarn/pnpm workspaces
    - Criar diretórios: `packages/desktop`, `packages/server`, `packages/relay-udp`, `packages/website`
    - Configurar TypeScript base (`tsconfig.json` raiz e por pacote)
    - Configurar ESLint e Prettier compartilhados
    - _Requisitos: 18.1, 18.2_

  - [x] 1.2 Configurar projeto Electron + React em `packages/desktop`
    - Inicializar projeto Electron com electron-builder
    - Configurar React com Vite como bundler
    - Instalar dependências: `react`, `react-dom`, `zustand`, `better-sqlite3`, `css-modules`
    - Configurar hot-reload para desenvolvimento
    - _Requisitos: 18.1, 18.2, 18.3_

  - [x] 1.3 Configurar projeto Node.js em `packages/server`
    - Inicializar projeto Node.js com TypeScript
    - Instalar dependências: `ws`, `jsonwebtoken`, `bcrypt`, `uuid`
    - Configurar scripts de build e dev
    - _Requisitos: 8.1_

  - [x] 1.4 Configurar projeto Go em `packages/relay-udp`
    - Inicializar módulo Go (`go mod init`)
    - Criar estrutura de diretórios: `cmd/relay`, `internal/tunnel`, `internal/vnet`
    - Adicionar dependência `wireguard-go`
    - _Requisitos: 8.1, 10.1_

  - [x] 1.5 Configurar projeto Astro em `packages/website`
    - Inicializar projeto Astro com template blank
    - Configurar integração React para componentes interativos
    - Configurar CSS global com variáveis da paleta MelNet
    - _Requisitos: 16.1, 17.1_

- [x] 2. Checkpoint — Verificar que todos os projetos compilam e rodam
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 3. Sistema de autenticação — Servidor
  - [x] 3.1 Implementar modelo de usuário e armazenamento no servidor
    - Criar interface `User` (id, nickname, email, passwordHash, avatarInitials)
    - Implementar armazenamento em memória (ou SQLite no servidor) para usuários
    - Implementar hashing de senha com bcrypt
    - _Requisitos: 1.1, 1.2_

  - [x] 3.2 Implementar endpoints de autenticação via WebSocket
    - Criar handler `register` (nickname, email, senha) → retorna JWT
    - Criar handler `login` (email, senha) → retorna JWT
    - Criar handler `guest-login` (nickname) → retorna JWT com flag `isGuest`
    - Implementar validação de campos obrigatórios e e-mail duplicado
    - _Requisitos: 1.1, 1.2, 1.3, 2.1, 2.2, 3.1_

  - [x] 3.3 Implementar rate limiting de login no servidor
    - Limitar a 5 tentativas de login por minuto por IP/cliente
    - Retornar erro de rate limiting com tempo de espera
    - _Requisitos: 2.3, 11.1_

  - [ ]* 3.4 Escrever testes unitários para autenticação
    - Testar registro com dados válidos e inválidos
    - Testar login com credenciais corretas e incorretas
    - Testar rate limiting de login
    - Testar acesso como convidado
    - _Requisitos: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1_

- [ ] 4. Sistema de autenticação — App Desktop
  - [x] 4.1 Criar tela de Login/Cadastro
    - Implementar formulário de cadastro (nickname, email, senha) com validação
    - Implementar formulário de login (email, senha)
    - Implementar botão de acesso como Convidado com campo de nickname
    - Destacar campos obrigatórios vazios com mensagens de validação
    - _Requisitos: 1.1, 1.2, 1.3, 2.1, 2.2, 3.1_

  - [x] 4.2 Implementar geração de Avatar Honeycomb
    - Criar componente React que gera avatar hexagonal baseado nas iniciais do nickname
    - Usar canvas ou SVG para renderizar o hexágono com as cores da paleta MelNet
    - _Requisitos: 1.4, 15.1_

  - [x] 4.3 Implementar lógica de conexão WebSocket e autenticação no cliente
    - Criar módulo `NetworkManager` para gerenciar conexão WebSocket com o servidor
    - Implementar fluxo de registro, login e guest-login
    - Armazenar JWT no estado (Zustand) e persistir sessão no Banco_Local
    - Exibir indicador visual de sessão temporária para convidados
    - _Requisitos: 1.1, 2.1, 3.1, 3.2, 3.3_

  - [x] 4.4 Implementar rate limiting visual de login no cliente
    - Bloquear UI de login após 5 tentativas em 1 minuto
    - Exibir mensagem de rate limiting com countdown de 60 segundos
    - _Requisitos: 2.3_

  - [ ]* 4.5 Escrever testes unitários para componentes de autenticação
    - Testar validação de formulários
    - Testar geração de avatar
    - Testar fluxo de autenticação
    - _Requisitos: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2_

- [x] 5. Checkpoint — Fluxo de autenticação funcional end-to-end
  - Ensure all tests pass, ask the user if questions arise.


- [ ] 6. Gerenciamento de salas — Servidor
  - [x] 6.1 Implementar Room Manager no servidor
    - Criar interface `Room` (id, name, password, maxPlayers, gameTag, hostId, inviteCode, status, members[])
    - Implementar criação de sala com geração de Código_Convite único (uuid curto)
    - Implementar validação: nome obrigatório, limite de jogadores entre 2 e 16
    - _Requisitos: 5.1, 5.2, 5.3, 5.4, 5.6_

  - [x] 6.2 Implementar handlers WebSocket para salas
    - Handler `create-room`: cria sala e retorna código de convite
    - Handler `join-room`: entrar por código, verificar senha se privada
    - Handler `leave-room`: sair da sala, notificar membros
    - Handler `kick-member`: apenas host pode expulsar, notificar membro expulso
    - Handler `list-rooms`: listar salas públicas em tempo real
    - Broadcast de eventos: membro entrou, membro saiu, sala atualizada
    - _Requisitos: 4.1, 4.4, 5.1, 5.3, 6.1, 6.5, 6.6, 7.1_

  - [x] 6.3 Implementar rate limiting de conexão a salas
    - Limitar a 10 tentativas de conexão a salas por minuto por cliente
    - Bloquear cliente por 5 minutos ao exceder limite
    - _Requisitos: 11.1_

  - [x] 6.4 Implementar rate limiting de chat
    - Limitar a 30 mensagens por minuto por cliente dentro de uma sala
    - Bloquear envio por 30 segundos ao exceder limite
    - _Requisitos: 11.2_

  - [ ]* 6.5 Escrever testes unitários para Room Manager
    - Testar criação, entrada, saída e expulsão
    - Testar validações e rate limiting
    - _Requisitos: 5.1, 5.2, 5.3, 5.6, 6.6, 11.1, 11.2_

- [ ] 7. Gerenciamento de salas — App Desktop
  - [x] 7.1 Implementar Dashboard Principal
    - Criar componente de lista de salas públicas com atualização em tempo real via WebSocket
    - Exibir botão "Criar Sala" e botão "Entrar com Código"
    - Exibir status de conexão com ícone animado de abelha (conectado/desconectado)
    - Exibir ping e qualidade de conexão com o servidor
    - _Requisitos: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 7.2 Implementar tela de Criação de Sala
    - Formulário: nome da sala, senha opcional, limite de jogadores (slider 2-16), tag de jogo
    - Validação de nome obrigatório
    - Exibir Código_Convite gerado após criação com botão de copiar
    - _Requisitos: 5.1, 5.2, 5.3, 5.4, 5.6_

  - [x] 7.3 Implementar tela de Sala (Room View)
    - Lista de membros com ping individual
    - Chat de texto simples com input e lista de mensagens
    - Botão "Copiar IP Virtual" que copia IP_Virtual para clipboard
    - Indicador de status da sala: aguardando / em jogo / encerrado
    - Controles de host: botão expulsar membro (visível apenas para host)
    - _Requisitos: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 7.1_

  - [x] 7.4 Implementar Log de Moderação para o Host
    - Criar componente que exibe tentativas suspeitas de conexão
    - Visível apenas para o host da sala
    - _Requisitos: 7.2, 7.3_

  - [ ]* 7.5 Escrever testes unitários para componentes de sala
    - Testar renderização do dashboard, criação de sala e room view
    - Testar interações de chat e cópia de IP
    - _Requisitos: 4.1, 5.1, 6.1, 6.2, 6.3_

- [x] 8. Checkpoint — Fluxo de salas funcional end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Rede virtual e tunelamento
  - [x] 9.1 Implementar Virtual Network Manager no servidor (Node.js)
    - Criar gerenciador de Sub_Rede_Virtual: alocar faixa 10.x.x.x por sala
    - Atribuir IP_Virtual único a cada membro ao entrar na sala
    - Liberar IPs e destruir sub-rede ao encerrar sala
    - _Requisitos: 8.2, 10.1, 10.2, 10.3_

  - [x] 9.2 Implementar UDP Relay em Go
    - Criar servidor UDP que recebe pacotes criptografados dos clientes
    - Implementar roteamento de pacotes por IP_Virtual destino dentro da mesma sala
    - Rejeitar pacotes entre salas diferentes (isolamento)
    - Rejeitar pacotes diretos entre clientes (forçar relay)
    - _Requisitos: 8.1, 8.4, 10.1, 10.2_

  - [x] 9.3 Implementar túnel criptografado no cliente (wireguard-go binding)
    - Criar módulo `TunnelClient` que estabelece túnel criptografado com o relay UDP
    - Implementar criptografia ChaCha20-Poly1305 para pacotes
    - Configurar interface de rede virtual (TUN/TAP) no sistema operacional
    - Rotear tráfego de jogo pelo túnel
    - _Requisitos: 8.1, 8.2, 8.3, 12.1_

  - [x] 9.4 Integrar WebSocket com UDP Relay
    - Quando sala é criada, WebSocket server notifica Go relay para preparar sub-rede
    - Quando membro entra, servidor envia credenciais de túnel ao cliente
    - Quando sala encerra, Go relay limpa recursos
    - _Requisitos: 5.5, 10.1, 10.3_

  - [ ]* 9.5 Escrever testes para tunelamento e rede virtual
    - Testar alocação e liberação de IPs virtuais
    - Testar isolamento entre salas
    - Testar rejeição de pacotes diretos
    - _Requisitos: 8.1, 8.4, 10.1, 10.2, 10.3_

- [x] 10. Checkpoint — Tunelamento e rede virtual funcionais
  - Ensure all tests pass, ask the user if questions arise.


- [ ] 11. Camada de segurança
  - [x] 11.1 Implementar Firewall de Aplicação no cliente
    - Criar módulo `ApplicationFirewall` (N-API nativo ou Go binding)
    - Implementar whitelist de portas/protocolos de jogos LAN conhecidos
    - Bloquear varreduras de porta (port scanning) e registrar no Log_Moderacao
    - Bloquear pings de rede direta entre clientes
    - Bloquear protocolos de acesso remoto: RDP (3389), VNC (5900), SSH (22)
    - Bloquear tráfego fora do escopo de jogo
    - _Requisitos: 9.1, 9.2, 9.3, 9.4, 12.1, 12.2_

  - [x] 11.2 Integrar Firewall com Tunnel Client
    - Inserir firewall como camada intermediária entre Network Manager e Tunnel Client
    - Filtrar pacotes antes de enviar pelo túnel
    - Enviar eventos de bloqueio ao Log_Moderacao via WebSocket
    - _Requisitos: 9.1, 9.2, 9.3, 7.2_

  - [x] 11.3 Implementar proteção de IP no servidor
    - Garantir que respostas WebSocket e dados de sala nunca incluam IPs reais
    - Sanitizar logs e payloads para remover qualquer referência a IPs reais
    - _Requisitos: 8.1, 8.3_

  - [ ]* 11.4 Escrever testes para firewall e segurança
    - Testar bloqueio de port scanning
    - Testar bloqueio de protocolos RDP/VNC/SSH
    - Testar que IPs reais não vazam em respostas
    - _Requisitos: 9.1, 9.2, 9.3, 9.4, 12.1, 12.2, 8.1, 8.3_

- [ ] 12. Persistência local (SQLite)
  - [x] 12.1 Implementar camada de banco de dados local
    - Configurar `better-sqlite3` no processo main do Electron
    - Criar schema: tabelas `preferences`, `room_history`, `user_session`
    - Implementar migrations para criação inicial do banco
    - _Requisitos: 14.1, 14.2_

  - [x] 12.2 Implementar repositórios de dados
    - Criar `PreferencesRepository`: salvar/carregar tema, interface de rede, notificações, auto-start
    - Criar `RoomHistoryRepository`: salvar/listar histórico de salas acessadas
    - Criar `SessionRepository`: persistir/recuperar sessão do usuário (JWT)
    - _Requisitos: 13.5, 14.1, 14.2, 14.3_

  - [x] 12.3 Integrar persistência com estado da aplicação
    - Carregar preferências do SQLite ao iniciar o app e aplicar ao Zustand store
    - Salvar alterações de configuração automaticamente no banco
    - Salvar entrada em salas no histórico
    - Limpar dados de sessão de convidado ao encerrar
    - _Requisitos: 3.3, 13.5, 14.1, 14.2, 14.3_

  - [ ]* 12.4 Escrever testes para persistência local
    - Testar CRUD de preferências
    - Testar histórico de salas
    - Testar limpeza de sessão de convidado
    - _Requisitos: 14.1, 14.2, 14.3, 3.3_

- [x] 13. Checkpoint — Segurança e persistência integradas
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Configurações do usuário
  - [x] 14.1 Implementar tela de Configurações
    - Seletor de interface de rede preferida (listar interfaces disponíveis do SO)
    - Toggle de notificações desktop
    - Toggle de inicialização automática com o sistema
    - Toggle de tema claro/escuro
    - Todas as alterações persistidas via SQLite automaticamente
    - _Requisitos: 13.1, 13.2, 13.3, 13.4, 13.5_

  - [x] 14.2 Implementar sistema de temas (claro/escuro)
    - Criar CSS variables com a paleta MelNet para ambos os temas
    - Tema escuro: fundo Preto Favo (#1A1A1A), texto Branco Cera (#FFFDF5)
    - Tema claro: fundo Branco Cera (#FFFDF5), texto Preto Favo (#1A1A1A)
    - Destaques: Amarelo Mel (#F5A623), Laranja Âmbar (#E07B00), Amarelo Claro (#FFD166)
    - Aplicar tema ao carregar preferências do banco
    - _Requisitos: 13.4, 15.1_

  - [x] 14.3 Implementar inicialização automática com o sistema
    - Usar API do Electron (`app.setLoginItemSettings`) para Windows e Linux
    - Respeitar toggle de configuração do usuário
    - _Requisitos: 13.3, 18.1, 18.2_

  - [ ]* 14.4 Escrever testes para configurações
    - Testar persistência de cada configuração
    - Testar alternância de tema
    - _Requisitos: 13.1, 13.2, 13.3, 13.4, 13.5_

- [ ] 15. Identidade visual e componentes UI
  - [x] 15.1 Implementar design system base
    - Configurar CSS Modules com variáveis globais da paleta MelNet
    - Criar componentes base: Button, Input, Card, Badge, Toggle, Modal, Tooltip
    - Configurar fontes: Inter/Poppins para texto, JetBrains Mono para código/IPs
    - Implementar ícones flat outline com stroke 1.5px (usar biblioteca como Lucide ou custom SVGs)
    - _Requisitos: 15.1, 15.2, 15.3, 15.4_

  - [x] 15.2 Implementar logo e ícone animado de abelha
    - Criar componente SVG do logo MelNet (hexágono com pontos de conexão)
    - Criar ícone animado de abelha para indicador de status de conexão
    - _Requisitos: 4.2, 15.4_

  - [x] 15.3 Aplicar identidade visual a todas as telas existentes
    - Revisar e aplicar paleta, tipografia e ícones em: Login, Dashboard, Criação de Sala, Room View, Configurações
    - Garantir consistência visual entre todas as telas
    - _Requisitos: 15.1, 15.2, 15.3, 15.4, 18.3_

- [x] 16. Checkpoint — App desktop completo e funcional
  - Ensure all tests pass, ask the user if questions arise.


- [ ] 17. Site institucional (Astro)
  - [x] 17.1 Implementar layout base e sistema de temas do site
    - Criar layout Astro com header (logo + nav) e footer (logo, links, redes sociais, licença)
    - Implementar CSS variables com paleta MelNet
    - Implementar toggle dark/light mode (dark como padrão)
    - Configurar fontes Inter/Poppins e responsividade mobile-first
    - _Requisitos: 16.8, 17.1, 17.2_

  - [x] 17.2 Implementar seção Hero
    - Headline: "Jogue com amigos. Sem risco. Sem complicação."
    - Sub-headline explicativa, botão CTA de download
    - Animação de hexágonos em CSS puro no background
    - Ícones de compatibilidade Windows e Linux
    - _Requisitos: 16.1_

  - [x] 17.3 Implementar seção "Como Funciona"
    - 3 cards em grid responsivo: Crie uma sala → Convide amigos → Jogue juntos
    - Ícones temáticos (favo, abelha, gamepad)
    - _Requisitos: 16.2_

  - [x] 17.4 Implementar seção "Segurança"
    - Comparativo visual MelNet vs Radmin VPN (tabela ou cards lado a lado)
    - Destaques: IP oculto, sem acesso remoto, tráfego isolado
    - _Requisitos: 16.3_

  - [x] 17.5 Implementar seção "Jogos Compatíveis"
    - Grid responsivo com logos/ícones de jogos populares com modo LAN
    - Badge "e muito mais..."
    - _Requisitos: 16.4_

  - [x] 17.6 Implementar seção "Tutorial"
    - Stepper visual com passos: Instalar → Criar conta → Criar sala → Copiar código → Jogar
    - Placeholder responsivo para vídeo embed do YouTube
    - _Requisitos: 16.5_

  - [x] 17.7 Implementar seção "Download"
    - Cards de versão: Windows (.exe) e Linux (.deb / AppImage)
    - Exibir versão atual, data de lançamento e changelog resumido
    - Botões grandes com ícones de OS
    - _Requisitos: 16.6_

  - [x] 17.8 Implementar seção "Contato/Suporte"
    - Formulário: nome, e-mail, assunto (dropdown), mensagem
    - Links para Discord, GitHub e e-mail de suporte
    - FAQ em formato accordion (5-6 perguntas)
    - _Requisitos: 16.7_

  - [x] 17.9 Implementar otimizações técnicas do site
    - Configurar lazy loading para imagens
    - Adicionar aria-labels em elementos interativos
    - Garantir contraste de cores adequado (mínimo WCAG AA)
    - Configurar meta tags, og:image e meta description para SEO
    - Animações CSS suaves sem bibliotecas externas pesadas
    - _Requisitos: 17.3, 17.4, 17.5, 17.6_

  - [ ]* 17.10 Escrever testes para o site institucional
    - Testar renderização de todas as seções
    - Testar responsividade e toggle de tema
    - Testar acessibilidade básica
    - _Requisitos: 17.1, 17.2, 17.5_

- [x] 18. Checkpoint — Site institucional completo
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 19. Empacotamento e distribuição multiplataforma
  - [x] 19.1 Configurar build do app desktop para Windows
    - Configurar electron-builder para gerar instalador .exe (NSIS)
    - Configurar ícone e metadados do aplicativo
    - Testar instalação e execução no Windows
    - _Requisitos: 18.1, 18.3_

  - [x] 19.2 Configurar build do app desktop para Linux
    - Configurar electron-builder para gerar pacotes .deb e AppImage
    - Configurar ícone e desktop entry para Linux
    - Testar instalação e execução em distribuições Debian-based
    - _Requisitos: 18.2, 18.3_

  - [x] 19.3 Configurar build do servidor relay
    - Criar Dockerfile para o servidor Node.js (WebSocket)
    - Criar Dockerfile para o relay UDP (Go)
    - Configurar docker-compose para orquestrar ambos os serviços
    - _Requisitos: 8.1, 10.1_

  - [x] 19.4 Configurar deploy do site institucional
    - Configurar build estático do Astro
    - Preparar para deploy em CDN/hosting estático (Vercel, Netlify ou similar)
    - _Requisitos: 16.1, 17.1_

- [x] 20. Checkpoint final — Sistema completo integrado
  - Ensure all tests pass, ask the user if questions arise.

## Notas

- Tarefas marcadas com `*` são opcionais e podem ser puladas para um MVP mais rápido
- Cada tarefa referencia requisitos específicos para rastreabilidade
- Checkpoints garantem validação incremental a cada fase
- A ordem das tarefas garante que cada etapa constrói sobre a anterior sem código órfão
