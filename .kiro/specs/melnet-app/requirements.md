# Documento de Requisitos — MelNet

## Introdução

O MelNet é um aplicativo desktop multiplataforma (Windows e Linux) que simula uma rede LAN local para jogos multiplayer, acompanhado de um site institucional responsivo. O sistema permite que usuários criem e entrem em salas virtuais que emulam uma rede local, direcionado a jogos com suporte a modo LAN (ex.: Minecraft, CS, Age of Empires). O diferencial principal em relação a soluções existentes (como Radmin VPN) é a segurança: o IP real dos usuários nunca é exposto, toda comunicação passa por um servidor relay central, e o tráfego é isolado por sala.

## Glossário

- **App_Desktop**: O aplicativo desktop MelNet, construído com Electron.js + React ou Tauri + Svelte, executado em Windows e Linux.
- **Servidor_Relay**: Servidor central responsável por intermediar toda comunicação entre clientes, garantindo que IPs reais nunca sejam expostos.
- **Sala_Virtual**: Ambiente isolado criado por um host onde jogadores se conectam via IPs virtuais para jogar em rede LAN simulada.
- **IP_Virtual**: Endereço IP atribuído dentro de uma Sala_Virtual (faixa 10.x.x.x), usado exclusivamente para comunicação de jogo. Nunca corresponde ao IP real do usuário.
- **Host**: O usuário que criou a Sala_Virtual e possui permissões de moderação (expulsar membros, visualizar logs).
- **Convidado**: Usuário que acessa o sistema com nickname temporário, sem cadastro completo.
- **Firewall_Aplicacao**: Componente do App_Desktop que filtra tráfego, permitindo apenas comunicação de jogo e bloqueando varreduras de porta e acessos não autorizados.
- **Código_Convite**: Código alfanumérico único gerado para cada Sala_Virtual, usado para convidar jogadores.
- **Site_Institucional**: Website responsivo (melnet.app) que apresenta o produto, oferece downloads e suporte.
- **Banco_Local**: Banco de dados SQLite local usado para armazenar preferências do usuário e histórico de salas.
- **Avatar_Honeycomb**: Avatar gerado automaticamente com base nas iniciais do nickname do usuário, estilizado no formato hexagonal (favo de mel).
- **Log_Moderacao**: Registro de tentativas suspeitas de conexão fora do padrão de jogo, acessível pelo Host da sala.
- **Sub_Rede_Virtual**: Rede virtual isolada criada para cada Sala_Virtual, impedindo comunicação entre salas diferentes.

## Requisitos

### Requisito 1: Cadastro de Usuário

**User Story:** Como um jogador, eu quero me cadastrar no MelNet com nickname, e-mail e senha, para que eu possa criar e entrar em salas de jogo.

#### Critérios de Aceitação

1. WHEN o jogador submete o formulário de cadastro com nickname, e-mail e senha válidos, THE App_Desktop SHALL criar a conta do usuário e redirecionar para o Dashboard Principal.
2. WHEN o jogador submete o formulário de cadastro com e-mail já registrado, THE App_Desktop SHALL exibir uma mensagem de erro informando que o e-mail já está em uso.
3. WHEN o jogador submete o formulário de cadastro com campos obrigatórios vazios, THE App_Desktop SHALL destacar os campos faltantes e exibir mensagem de validação para cada campo.
4. WHEN a conta é criada com sucesso, THE App_Desktop SHALL gerar um Avatar_Honeycomb baseado nas iniciais do nickname do usuário.

### Requisito 2: Login de Usuário

**User Story:** Como um jogador cadastrado, eu quero fazer login com e-mail e senha, para que eu possa acessar minhas salas e configurações.

#### Critérios de Aceitação

1. WHEN o jogador submete credenciais válidas de e-mail e senha, THE App_Desktop SHALL autenticar o usuário e exibir o Dashboard Principal.
2. WHEN o jogador submete credenciais inválidas, THE App_Desktop SHALL exibir uma mensagem de erro genérica sem revelar qual campo está incorreto.
3. IF o jogador excede 5 tentativas de login em 1 minuto, THEN THE App_Desktop SHALL bloquear novas tentativas por 60 segundos e exibir uma mensagem de rate limiting.

### Requisito 3: Acesso como Convidado

**User Story:** Como um jogador casual, eu quero acessar o MelNet com um nickname temporário sem criar conta, para que eu possa jogar rapidamente.

#### Critérios de Aceitação

1. WHEN o jogador seleciona a opção de acesso como Convidado e informa um nickname, THE App_Desktop SHALL criar uma sessão temporária e exibir o Dashboard Principal.
2. WHILE o jogador está em sessão de Convidado, THE App_Desktop SHALL exibir um indicador visual de que a sessão é temporária.
3. WHEN a sessão de Convidado é encerrada, THE App_Desktop SHALL descartar todos os dados da sessão temporária.

### Requisito 4: Dashboard Principal

**User Story:** Como um jogador autenticado, eu quero visualizar as salas disponíveis e meu status de conexão, para que eu possa escolher onde jogar.

#### Critérios de Aceitação

1. THE App_Desktop SHALL exibir a lista de Salas_Virtuais públicas disponíveis em tempo real no Dashboard Principal.
2. THE App_Desktop SHALL exibir o status de conexão do usuário com o Servidor_Relay por meio de um ícone animado de abelha.
3. THE App_Desktop SHALL exibir o valor de ping e a qualidade de conexão do usuário com o Servidor_Relay.
4. WHEN uma nova Sala_Virtual pública é criada ou removida, THE App_Desktop SHALL atualizar a lista de salas em tempo real sem necessidade de recarregamento manual.
5. THE App_Desktop SHALL exibir um botão para criar nova Sala_Virtual e um botão para entrar em sala via Código_Convite.

### Requisito 5: Criação de Sala

**User Story:** Como um jogador, eu quero criar uma sala de jogo com configurações personalizadas, para que eu possa convidar amigos para jogar.

#### Critérios de Aceitação

1. WHEN o jogador preenche o nome da sala e confirma a criação, THE App_Desktop SHALL criar a Sala_Virtual e gerar um Código_Convite único.
2. THE App_Desktop SHALL permitir que o jogador defina um limite de jogadores entre 2 e 16 para a Sala_Virtual.
3. WHERE o jogador define uma senha para a sala, THE App_Desktop SHALL exigir a senha de todos os jogadores que tentarem entrar na Sala_Virtual.
4. THE App_Desktop SHALL permitir que o jogador selecione uma tag ou categoria de jogo para a Sala_Virtual.
5. WHEN a Sala_Virtual é criada, THE Servidor_Relay SHALL criar uma Sub_Rede_Virtual isolada para a sala.
6. IF o jogador tenta criar uma sala com nome vazio, THEN THE App_Desktop SHALL exibir uma mensagem de validação solicitando o preenchimento do nome.

### Requisito 6: Funcionalidades Dentro da Sala

**User Story:** Como um jogador dentro de uma sala, eu quero ver os membros conectados, conversar por texto e copiar meu IP virtual, para que eu possa me comunicar e configurar o jogo.

#### Critérios de Aceitação

1. THE App_Desktop SHALL exibir a lista de membros da Sala_Virtual com o valor de ping individual de cada membro.
2. THE App_Desktop SHALL fornecer um chat de texto simples dentro da Sala_Virtual para comunicação entre membros.
3. WHEN o jogador clica no botão "Copiar IP Virtual", THE App_Desktop SHALL copiar o IP_Virtual do jogador para a área de transferência.
4. THE App_Desktop SHALL exibir apenas o IP_Virtual de cada membro, sem expor o IP real em nenhuma circunstância.
5. THE App_Desktop SHALL exibir o status da Sala_Virtual como "aguardando", "em jogo" ou "encerrado".
6. WHEN o Host clica em expulsar um membro, THE App_Desktop SHALL remover o membro da Sala_Virtual e notificar o membro expulso.

### Requisito 7: Permissões do Host

**User Story:** Como host de uma sala, eu quero moderar os participantes e visualizar logs de atividade suspeita, para que eu possa manter a sala segura.

#### Critérios de Aceitação

1. WHILE o jogador é o Host da Sala_Virtual, THE App_Desktop SHALL exibir controles de moderação (expulsar membro) na interface da sala.
2. THE App_Desktop SHALL registrar tentativas suspeitas de conexão fora do padrão de jogo no Log_Moderacao.
3. WHILE o jogador é o Host da Sala_Virtual, THE App_Desktop SHALL permitir acesso ao Log_Moderacao da sala.

### Requisito 8: Proteção de IP Real

**User Story:** Como um jogador, eu quero que meu IP real nunca seja exposto a outros jogadores, para que eu esteja protegido contra ataques e invasões.

#### Critérios de Aceitação

1. THE Servidor_Relay SHALL intermediar toda comunicação entre clientes, impedindo que qualquer cliente obtenha o IP real de outro cliente.
2. THE App_Desktop SHALL atribuir um IP_Virtual da faixa 10.x.x.x a cada jogador dentro de uma Sala_Virtual.
3. THE App_Desktop SHALL exibir apenas IPs_Virtuais na interface, em logs e em qualquer dado acessível ao usuário.
4. IF um cliente tenta enviar pacotes diretamente para outro cliente sem passar pelo Servidor_Relay, THEN THE Servidor_Relay SHALL rejeitar a conexão.

### Requisito 9: Firewall de Aplicação

**User Story:** Como um jogador, eu quero que apenas tráfego de jogo seja permitido na rede virtual, para que minha máquina esteja protegida contra varreduras de porta e acessos indevidos.

#### Critérios de Aceitação

1. THE Firewall_Aplicacao SHALL permitir apenas tráfego originado de aplicações de jogo reconhecidas na Sub_Rede_Virtual.
2. WHEN o Firewall_Aplicacao detecta uma tentativa de varredura de porta (port scanning), THE Firewall_Aplicacao SHALL bloquear a tentativa e registrar o evento no Log_Moderacao.
3. WHEN o Firewall_Aplicacao detecta tentativa de acesso a serviços fora do escopo de jogo, THE Firewall_Aplicacao SHALL bloquear o tráfego.
4. THE Firewall_Aplicacao SHALL bloquear pings de rede direta entre clientes.

### Requisito 10: Isolamento por Sala

**User Story:** Como um jogador, eu quero que minha sala seja completamente isolada de outras salas, para que jogadores de outras salas não possam acessar minha rede.

#### Critérios de Aceitação

1. THE Servidor_Relay SHALL criar uma Sub_Rede_Virtual isolada para cada Sala_Virtual.
2. THE Servidor_Relay SHALL impedir que membros de uma Sala_Virtual acessem ou visualizem membros de outra Sala_Virtual.
3. WHEN uma Sala_Virtual é encerrada, THE Servidor_Relay SHALL destruir a Sub_Rede_Virtual associada e liberar todos os IPs_Virtuais alocados.

### Requisito 11: Rate Limiting

**User Story:** Como operador do sistema, eu quero limitar tentativas de conexão abusivas, para que o sistema permaneça estável e seguro.

#### Critérios de Aceitação

1. IF um cliente excede 10 tentativas de conexão a salas em 1 minuto, THEN THE Servidor_Relay SHALL bloquear novas tentativas do cliente por 5 minutos.
2. IF um cliente excede 30 mensagens de chat em 1 minuto dentro de uma Sala_Virtual, THEN THE App_Desktop SHALL limitar o envio de mensagens do cliente por 30 segundos.

### Requisito 12: Bloqueio de Acesso Remoto

**User Story:** Como um jogador, eu quero ter certeza de que o MelNet não permite funcionalidades de área de trabalho remota, para que minha máquina esteja protegida.

#### Critérios de Aceitação

1. THE App_Desktop SHALL restringir o tráfego da Sub_Rede_Virtual exclusivamente a protocolos de jogo LAN.
2. THE Firewall_Aplicacao SHALL bloquear protocolos de área de trabalho remota (RDP, VNC, SSH) na Sub_Rede_Virtual.

### Requisito 13: Configurações do Usuário

**User Story:** Como um jogador, eu quero personalizar as configurações do aplicativo, para que o MelNet funcione de acordo com minhas preferências.

#### Critérios de Aceitação

1. THE App_Desktop SHALL permitir que o usuário selecione a interface de rede preferida para conexão.
2. THE App_Desktop SHALL permitir que o usuário ative ou desative notificações desktop.
3. THE App_Desktop SHALL permitir que o usuário ative ou desative a inicialização automática com o sistema operacional.
4. THE App_Desktop SHALL permitir que o usuário alterne entre tema claro e tema escuro, mantendo a paleta de cores MelNet.
5. WHEN o usuário altera uma configuração, THE Banco_Local SHALL persistir a alteração localmente via SQLite.

### Requisito 14: Persistência Local de Dados

**User Story:** Como um jogador, eu quero que minhas preferências e histórico de salas sejam salvos localmente, para que eu não precise reconfigurar o aplicativo a cada uso.

#### Critérios de Aceitação

1. THE Banco_Local SHALL armazenar as preferências do usuário (tema, interface de rede, notificações, inicialização automática) em SQLite.
2. THE Banco_Local SHALL armazenar o histórico de Salas_Virtuais acessadas pelo usuário.
3. WHEN o App_Desktop é iniciado, THE App_Desktop SHALL carregar as preferências salvas no Banco_Local e aplicá-las à interface.

### Requisito 15: Identidade Visual — Tema Abelha & Mel

**User Story:** Como um jogador, eu quero que o MelNet tenha uma identidade visual coesa e temática, para que a experiência de uso seja agradável e memorável.

#### Critérios de Aceitação

1. THE App_Desktop SHALL utilizar a paleta de cores MelNet: Amarelo Mel (#F5A623), Laranja Âmbar (#E07B00), Amarelo Claro (#FFD166), Preto Favo (#1A1A1A), Branco Cera (#FFFDF5), Cinza Favinho (#3D3D3D).
2. THE App_Desktop SHALL utilizar as fontes Inter ou Poppins para títulos e corpo de texto, e JetBrains Mono para exibição de código e IPs.
3. THE App_Desktop SHALL utilizar ícones no estilo flat outline com stroke de 1.5px.
4. THE App_Desktop SHALL exibir o logo MelNet como um hexágono estilizado com pontos de conexão de rede.

### Requisito 16: Site Institucional — Estrutura e Conteúdo

**User Story:** Como um visitante do site, eu quero conhecer o MelNet, entender como funciona e baixar o aplicativo, para que eu possa começar a usar o produto.

#### Critérios de Aceitação

1. THE Site_Institucional SHALL exibir uma seção Hero com headline, sub-headline, botão de download e animação de hexágonos em CSS.
2. THE Site_Institucional SHALL exibir uma seção "Como Funciona" com 3 cards explicativos: Crie uma sala, Convide amigos, Jogue juntos.
3. THE Site_Institucional SHALL exibir uma seção "Segurança" com comparativo visual entre MelNet e Radmin VPN.
4. THE Site_Institucional SHALL exibir uma seção "Jogos Compatíveis" com grid de logos de jogos populares com modo LAN.
5. THE Site_Institucional SHALL exibir uma seção "Tutorial" com passo a passo visual ou vídeo embed responsivo.
6. THE Site_Institucional SHALL exibir uma seção "Download" com cards de versão para Windows (.exe) e Linux (.deb / AppImage), incluindo versão atual e changelog resumido.
7. THE Site_Institucional SHALL exibir uma seção "Contato/Suporte" com formulário (nome, e-mail, assunto, mensagem), links para Discord, GitHub e e-mail de suporte, e FAQ em formato accordion.
8. THE Site_Institucional SHALL exibir um rodapé com logo, links rápidos, redes sociais e aviso de licença.

### Requisito 17: Site Institucional — Requisitos Técnicos

**User Story:** Como um visitante do site, eu quero que o site seja rápido, responsivo e acessível, para que eu tenha uma boa experiência em qualquer dispositivo.

#### Critérios de Aceitação

1. THE Site_Institucional SHALL ser 100% responsivo, seguindo abordagem mobile-first.
2. THE Site_Institucional SHALL utilizar tema escuro como padrão, com toggle para alternar para tema claro.
3. THE Site_Institucional SHALL utilizar animações suaves em CSS, sem dependência de bibliotecas externas pesadas.
4. THE Site_Institucional SHALL implementar lazy loading para imagens e otimização de assets para performance.
5. THE Site_Institucional SHALL implementar acessibilidade básica: aria-labels em elementos interativos e contraste de cores adequado (mínimo WCAG AA).
6. THE Site_Institucional SHALL implementar SEO básico: meta tags, og:image e meta description em todas as páginas.

### Requisito 18: Compatibilidade Multiplataforma

**User Story:** Como um jogador, eu quero usar o MelNet tanto no Windows quanto no Linux, para que eu possa jogar independentemente do meu sistema operacional.

#### Critérios de Aceitação

1. THE App_Desktop SHALL ser compatível com Windows 10 ou superior.
2. THE App_Desktop SHALL ser compatível com distribuições Linux baseadas em Debian (Ubuntu, Mint) e disponibilizar pacotes .deb e AppImage.
3. THE App_Desktop SHALL manter funcionalidade e aparência consistentes entre Windows e Linux.
