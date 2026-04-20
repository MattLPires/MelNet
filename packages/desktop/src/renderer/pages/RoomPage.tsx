import React, { useEffect, useState, useRef, useCallback } from 'react';
import styles from './RoomPage.module.css';
import { networkManager, ServerMessage } from '../network/NetworkManager';
import { useAuthStore } from '../store/authStore';
import ModerationLog from '../components/ModerationLog';

export interface RoomMember { userId: string; nickname: string; }
export type RoomStatus = 'waiting' | 'playing' | 'closed';

interface ChatMessage { id: string; userId: string; nickname: string; message: string; timestamp: string; isSystem?: boolean; }

interface RoomPageProps {
  roomId: string;
  roomName: string;
  members: RoomMember[];
  hostId: string;
  inviteCode: string;
  tunnel?: { virtualIp: string; relayHost: string; relayPort: number; tunnelKey: string; };
  onBack: () => void;
}

let msgId = 0;
const nextId = () => `m-${++msgId}`;

const RoomPage: React.FC<RoomPageProps> = ({ roomId, roomName, members: initialMembers, hostId, inviteCode, tunnel: tunnelCreds, onBack }) => {
  const { user } = useAuthStore();
  const [members, setMembers] = useState<RoomMember[]>(initialMembers);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [ipCopied, setIpCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [tunnelStatus, setTunnelStatus] = useState<'off' | 'connecting' | 'on'>('off');
  const [virtualIp, setVirtualIp] = useState(tunnelCreds?.virtualIp ?? '—');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isHost = user?.id === hostId;

  const addSystem = useCallback((text: string) => {
    setMessages((prev) => [...prev, { id: nextId(), userId: '', nickname: '', message: text, timestamp: new Date().toISOString(), isSystem: true }]);
  }, []);

  // Cleanup tunnel on unmount
  useEffect(() => {
    return () => { window.melnetTunnel?.stop().catch(() => {}); };
  }, []);

  const toggleTunnel = async () => {
    if (tunnelStatus === 'on') {
      // Turn off
      await window.melnetTunnel?.stop().catch(() => {});
      setTunnelStatus('off');
      addSystem('Túnel desligado');
      return;
    }

    if (!tunnelCreds) {
      addSystem('Credenciais de túnel não disponíveis');
      return;
    }

    setTunnelStatus('connecting');
    try {
      const timeout = new Promise<{ success: false; error: string }>((resolve) =>
        setTimeout(() => resolve({ success: false, error: 'Tempo esgotado (10s)' }), 10000)
      );
      const attempt = window.melnetTunnel?.start({
        virtualIp: tunnelCreds.virtualIp,
        subnet: '255.255.255.0',
        relayHost: tunnelCreds.relayHost,
        relayPort: tunnelCreds.relayPort,
        tunnelKey: tunnelCreds.tunnelKey,
      }) ?? Promise.resolve({ success: false as const, error: 'API indisponível' });

      const result = await Promise.race([attempt, timeout]);
      if (result?.success) {
        setTunnelStatus('on');
        if ('virtualIp' in result && result.virtualIp) setVirtualIp(result.virtualIp as string);
        addSystem(`Túnel ligado — IP: ${tunnelCreds.virtualIp}`);
      } else {
        setTunnelStatus('off');
        window.melnetTunnel?.stop().catch(() => {});
        addSystem(`Falha: ${('error' in result ? result.error : null) ?? 'erro desconhecido'}`);
      }
    } catch {
      setTunnelStatus('off');
      addSystem('Falha ao ligar túnel');
    }
  };

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    const onChat = (msg: ServerMessage) => {
      const p = msg.payload as { roomId: string; userId: string; nickname: string; message: string; timestamp: string };
      if (p.roomId !== roomId) return;
      setMessages((prev) => [...prev, { id: nextId(), userId: p.userId, nickname: p.nickname, message: p.message, timestamp: p.timestamp }]);
    };
    const onJoin = (msg: ServerMessage) => {
      const p = msg.payload as { roomId: string; userId: string; nickname: string };
      if (p.roomId !== roomId) return;
      setMembers((prev) => prev.some((m) => m.userId === p.userId) ? prev : [...prev, { userId: p.userId, nickname: p.nickname }]);
      addSystem(`${p.nickname} entrou na sala`);
    };
    const onLeft = (msg: ServerMessage) => {
      const p = msg.payload as { roomId: string; userId: string };
      if (p.roomId !== roomId) return;
      setMembers((prev) => { const m = prev.find((x) => x.userId === p.userId); if (m) addSystem(`${m.nickname} saiu`); return prev.filter((x) => x.userId !== p.userId); });
    };
    const onKicked = (msg: ServerMessage) => {
      const p = msg.payload as { roomId: string; userId: string; kickedUserId?: string };
      const kid = p.kickedUserId ?? p.userId;
      if (p.roomId !== roomId) return;
      if (kid === user?.id) { onBack(); return; }
      setMembers((prev) => { const m = prev.find((x) => x.userId === kid); if (m) addSystem(`${m.nickname} foi removido`); return prev.filter((x) => x.userId !== kid); });
    };
    networkManager.on('chat-message', onChat);
    networkManager.on('member-joined', onJoin);
    networkManager.on('member-left', onLeft);
    networkManager.on('member-kicked', onKicked);
    return () => { networkManager.off('chat-message', onChat); networkManager.off('member-joined', onJoin); networkManager.off('member-left', onLeft); networkManager.off('member-kicked', onKicked); };
  }, [roomId, user?.id, onBack, addSystem]);

  const sendMsg = (e: React.FormEvent) => { e.preventDefault(); const t = inputText.trim(); if (!t) return; try { networkManager.send('chat-message', { roomId, message: t }); setInputText(''); } catch { /* */ } };
  const copyIp = async () => { try { await navigator.clipboard.writeText(virtualIp); setIpCopied(true); setTimeout(() => setIpCopied(false), 1500); } catch { /* */ } };
  const copyCode = async () => { try { await navigator.clipboard.writeText(inviteCode); setCodeCopied(true); setTimeout(() => setCodeCopied(false), 1500); } catch { /* */ } };
  const goBack = () => onBack();
  const disconnect = () => { window.melnetTunnel?.stop().catch(() => {}); try { networkManager.send('leave-room', { roomId }); } catch { /* */ } onBack(); };
  const kick = (uid: string) => { try { networkManager.send('kick-member', { roomId, userId: uid }); } catch { /* */ } };
  const fmtTime = (ts: string) => { try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={goBack} data-testid="leave-btn">Voltar</button>
        <div className={styles.headerCenter}>
          <h1 className={styles.roomTitle}>{roomName}</h1>
          <span className={styles.roomBadge} data-testid="room-status">Aguardando</span>
        </div>
        <div className={styles.headerActions}>
          <button className={`${styles.smallBtn} ${codeCopied ? styles.copied : ''}`} onClick={copyCode}>
            {codeCopied ? 'Copiado' : `Código: ${inviteCode}`}
          </button>
        </div>
      </header>

      <div className={styles.body}>
        <aside className={styles.sidebar}>
          {/* Tunnel toggle */}
          <div className={styles.tunnelSection}>
            <div className={styles.tunnelRow}>
              <div className={styles.tunnelInfo}>
                <span className={styles.tunnelLabel}>Rede Virtual</span>
                <span className={styles.tunnelIp}>{tunnelStatus === 'on' ? virtualIp : '—'}</span>
              </div>
              <button
                className={`${styles.tunnelToggle} ${tunnelStatus === 'on' ? styles.tunnelOn : ''} ${tunnelStatus === 'connecting' ? styles.tunnelConnecting : ''}`}
                onClick={toggleTunnel}
                disabled={tunnelStatus === 'connecting' || !tunnelCreds}
                aria-label={tunnelStatus === 'on' ? 'Desligar túnel' : 'Ligar túnel'}
              >
                <span className={styles.tunnelToggleKnob} />
              </button>
            </div>
            {tunnelStatus === 'connecting' && <span className={styles.tunnelHint}>Conectando...</span>}
            {tunnelStatus === 'on' && <span className={styles.tunnelHint}>Conectado ao relay</span>}
            {tunnelStatus === 'off' && tunnelCreds && <span className={styles.tunnelHint}>Desligado</span>}
            {!tunnelCreds && <span className={styles.tunnelHint}>Indisponível nesta sala</span>}
          </div>

          <div className={styles.sideSection}>
            <div className={styles.sideLabel}>Membros ({members.length})</div>
            <div className={styles.memberList} data-testid="member-list">
              {members.map((m) => (
                <div key={m.userId} className={styles.memberItem} data-testid="member-item">
                  <div className={styles.memberInfo}>
                    <span className={`${styles.memberName} ${m.userId === hostId ? styles.memberHost : ''}`}>{m.nickname}</span>
                    {m.userId === hostId && <span className={styles.hostTag}>host</span>}
                  </div>
                  {isHost && m.userId !== hostId && (
                    <button className={styles.kickBtn} onClick={() => kick(m.userId)} data-testid={`kick-${m.userId}`} aria-label={`Remover ${m.nickname}`}>Remover</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <ModerationLog roomId={roomId} isHost={isHost} />

          <div className={styles.sideActions}>
            <button className={`${styles.actionBtn} ${ipCopied ? styles.copied : ''}`} onClick={copyIp} data-testid="copy-ip-btn">
              {ipCopied ? 'IP copiado' : `Copiar IP (${virtualIp})`}
            </button>
            <button className={styles.leaveBtn} onClick={disconnect} data-testid="leave-sidebar-btn">Desconectar da sala</button>
          </div>
        </aside>

        <div className={styles.chatArea}>
          <div className={styles.messages} data-testid="chat-messages">
            {messages.length === 0 && (
              <div className={styles.chatEmpty}>
                <p>Nenhuma mensagem ainda</p>
                <p className={styles.chatEmptyHint}>Diga oi para seus amigos</p>
              </div>
            )}
            {messages.map((msg) =>
              msg.isSystem ? (
                <div key={msg.id} className={styles.systemMsg}>{msg.message}</div>
              ) : (
                <div key={msg.id} className={styles.chatMsg}>
                  <div className={styles.chatMsgHeader}>
                    <span className={styles.chatAuthor}>{msg.nickname}</span>
                    <span className={styles.chatTime}>{fmtTime(msg.timestamp)}</span>
                  </div>
                  <span className={styles.chatText}>{msg.message}</span>
                </div>
              )
            )}
            <div ref={messagesEndRef} />
          </div>
          <form className={styles.chatInput} onSubmit={sendMsg}>
            <input className={styles.chatField} type="text" placeholder="Digite uma mensagem..." value={inputText} onChange={(e) => setInputText(e.target.value)} data-testid="chat-input" />
            <button type="submit" className={styles.sendBtn} disabled={!inputText.trim()} data-testid="send-btn">Enviar</button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RoomPage;
