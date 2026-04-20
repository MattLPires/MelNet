Você é um desenvolvedor full-stack sênior especializado em aplicações de rede, segurança e design de interfaces modernas. Sua tarefa é projetar e desenvolver completamente o sistema "MelNet" — um aplicativo desktop de simulação de LAN local com foco em jogos multiplayer, acompanhado de um site institucional responsivo.


VISÃO GERAL:
O MelNet é um aplicativo desktop multiplataforma (Windows e Linux) que permite que usuários criem e entrem em salas virtuais que simulam uma rede LAN local, sendo indicado principalmente para jogos que suportam modo LAN (ex.: Minecraft, CS, Age of Empires, etc.).

TECNOLOGIAS SUGERIDAS:
- Frontend do app: Electron.js + React (ou Tauri com Svelte para leveza)
- Backend/rede: Node.js com WebSocket ou Go para o servidor de relay
- VPN/Tunelamento: uso de tecnologia similar ao ZeroTier ou criação de túneis criptografados via WireGuard-like protocol
- Banco de dados local: SQLite (para salvar preferências, histórico de salas)

FUNCIONALIDADES OBRIGATÓRIAS:

1. TELA DE LOGIN / CADASTRO
   - Cadastro com nickname, e-mail e senha
   - Login com e-mail/senha ou acesso como convidado com nickname temporário
   - Avatar gerado automaticamente com base nas iniciais (estilo honeycomb)

2. DASHBOARD PRINCIPAL
   - Lista de salas disponíveis (públicas) em tempo real
   - Botão de criar sala
   - Botão de entrar com código da sala
   - Status de conexão (ícone animado de abelha quando conectado)
   - Ping e qualidade de conexão visíveis

3. CRIAÇÃO DE SALA
   - Nome da sala
   - Senha opcional (sala privada)
   - Limite de jogadores (2 a 16)
   - Seleção do jogo principal (tag/categoria)
   - Geração de código único para convidar amigos

4. DENTRO DA SALA
   - Lista de membros com ping individual
   - Chat de texto simples dentro da sala
   - O host pode expulsar membros
   - Botão "Copiar IP Virtual" — fornece apenas o IP virtual da rede simulada (não o IP real)
   - Indicador de status: aguardando / em jogo / encerrado

5. CONFIGURAÇÕES
   - Escolher interface de rede preferida
   - Notificações desktop
   - Iniciar com o sistema (toggle)
   - Tema: claro/escuro (mantendo a paleta MelNet)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔒 PARTE 2 — SEGURANÇA (diferencial do MelNet vs Radmin)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

O MelNet deve resolver os problemas de segurança do Radmin VPN, especificamente:

PROBLEMA NO RADMIN:
No Radmin, ao entrar em uma sala, membros têm acesso ao IP real dos outros participantes e, em algumas configurações, podem tentar conexões diretas à máquina do outro usuário, expondo portas e serviços.

SOLUÇÃO NO MELNET:
1. IP REAL NUNCA EXPOSTO — toda comunicação passa por um servidor relay central. Nenhum cliente jamais conhece o IP real de outro cliente. Apenas IPs virtuais (ex.: 10.x.x.x) são visíveis dentro da sala.

2. FIREWALL DE APLICAÇÃO — apenas tráfego originado de aplicações de jogo reconhecidas é roteado. O app bloqueia varreduras de porta (port scanning), pings de rede direta e tentativas de acesso a serviços fora do escopo do jogo.

3. ISOLAMENTO POR SALA — cada sala cria uma sub-rede virtual isolada. Um membro da Sala A não consegue ver ou acessar membros da Sala B.

4. SEM PERMISSÃO DE ÁREA DE TRABALHO REMOTA — o MelNet é exclusivamente para jogos LAN. Não possui, e nunca implementará, funcionalidades de acesso remoto à máquina.

5. RATE LIMITING — limite de tentativas de conexão para evitar abusos dentro da sala.

6. LOG DE MODERAÇÃO — o host da sala recebe um log de tentativas suspeitas de conexão fora do padrão de jogo.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎨 PARTE 3 — IDENTIDADE VISUAL (Paleta Abelha & Mel)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Nome: MelNet
Conceito visual: Favo de mel + tecnologia + conexão

PALETA DE CORES:
- Amarelo Mel:     #F5A623  (cor primária — botões, destaques, ícones ativos)
- Laranja Âmbar:   #E07B00  (hover, bordas de ênfase, gradientes)
- Amarelo Claro:   #FFD166  (backgrounds de cards, badges)
- Preto Favo:      #1A1A1A  (fundo escuro, textos primários no tema dark)
- Branco Cera:     #FFFDF5  (fundo claro, superfícies no tema light)
- Cinza Favinho:   #3D3D3D  (textos secundários, ícones inativos)

LOGO:
Hexágono estilizado formado por pontos de conexão de rede, com o texto "MelNet" em fonte geométrica sans-serif bold. O hexágono remete ao favo e à topologia de rede simultaneamente.

TIPOGRAFIA:
- Títulos: Inter Bold ou Poppins 700
- Corpo: Inter Regular 400
- Código/IPs: JetBrains Mono

ÍCONES: estilo flat outline com stroke de 1.5px — sem preenchimento sólido exceto nos estados ativos.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 PARTE 4 — SITE INSTITUCIONAL (melnet.app ou similar)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TECNOLOGIA: HTML5 + CSS3 + JavaScript vanilla (ou Next.js/Astro para SEO), hospedagem estática.

PÁGINAS E SEÇÕES:

1. HOME / HERO
   - Headline impactante: "Jogue com amigos. Sem risco. Sem complicação."
   - Sub-headline explicando o conceito
   - Botão CTA grande: "Baixar MelNet — Grátis"
   - Animação de fundo: hexágonos em movimento leve (CSS animation)
   - Compatibilidade: ícones de Windows e Linux

2. SEÇÃO "COMO FUNCIONA"
   - 3 cards em grid: Crie uma sala → Convide amigos → Jogue juntos
   - Ícones ilustrativos temáticos (favo, abelha, gamepad)

3. SEÇÃO "SEGURANÇA EM PRIMEIRO LUGAR"
   - Comparativo visual: MelNet vs Radmin VPN
   - Destaque: IP oculto, sem acesso remoto, tráfego isolado

4. SEÇÃO "JOGOS COMPATÍVEIS"
   - Grid com logos/ícones de jogos populares com modo LAN
   - Badge "e muito mais..."

5. SEÇÃO "TUTORIAL DE USO"
   - Stepper visual (passo a passo) com screenshots mockados
   - Ou vídeo embed do YouTube (placeholder responsivo)
   - Passos: Instalar → Criar conta → Criar sala → Copiar código → Jogar

6. SEÇÃO "DOWNLOAD"
   - Cards de versão: Windows (.exe installer) e Linux (.deb / AppImage)
   - Versão atual, data de lançamento e changelog resumido
   - Botões grandes com ícones de OS

7. SEÇÃO "CONTATO / SUPORTE"
   - Formulário: Nome, E-mail, Assunto (dropdown), Mensagem
   - Links para Discord da comunidade, GitHub e e-mail de suporte
   - FAQ accordion com 5-6 perguntas frequentes

8. RODAPÉ
   - Logo, links rápidos, redes sociais, aviso de licença open-source (se aplicável)

REQUISITOS TÉCNICOS DO SITE:
- 100% responsivo (mobile-first)
- Dark mode padrão com toggle para light
- Animações suaves com CSS (sem libs pesadas)
- Performance: sem imagens não otimizadas, lazy loading
- Acessibilidade básica: aria-labels, contraste adequado
- SEO básico: meta tags, og:image, descrição