import React, { useState } from 'react';
import styles from './CreateRoomPage.module.css';
import { networkManager, ServerMessage } from '../network/NetworkManager';
import { useAuthStore } from '../store/authStore';
import type { RoomPageState } from '../App';

interface CreateRoomPageProps {
  onBack: () => void;
  onRoomCreated?: (state: RoomPageState) => void;
}

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 16;
const DEFAULT_PLAYERS = 8;

export { MIN_PLAYERS, MAX_PLAYERS, DEFAULT_PLAYERS };

const CreateRoomPage: React.FC<CreateRoomPageProps> = ({ onBack, onRoomCreated }) => {
  const { user } = useAuthStore();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(DEFAULT_PLAYERS);
  const [gameTag, setGameTag] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [createdRoomId, setCreatedRoomId] = useState<string | null>(null);
  const [createdTunnel, setCreatedTunnel] = useState<{ virtualIp: string; relayHost: string; relayPort: number; tunnelKey: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setNameError(null);

    if (!name.trim()) {
      setNameError('Nome da sala e obrigatorio');
      return;
    }

    setLoading(true);

    const payload: Record<string, unknown> = { name: name.trim() };
    if (password) payload.password = password;
    if (maxPlayers !== DEFAULT_PLAYERS) payload.maxPlayers = maxPlayers;
    if (gameTag.trim()) payload.gameTag = gameTag.trim();

    const onCreated = (msg: ServerMessage) => {
      cleanup();
      const p = msg.payload as { inviteCode: string; tunnel?: { virtualIp: string; relayHost: string; relayPort: number; tunnelKey: string }; room: { id: string; name: string; members: { userId: string; nickname: string }[]; hostId: string } };
      setInviteCode(p.inviteCode);
      setCreatedRoomId(p.room.id);
      setCreatedTunnel(p.tunnel ?? null);
      setLoading(false);
    };

    const onError = (msg: ServerMessage) => {
      cleanup();
      const { message } = msg.payload as { message?: string };
      setServerError(message ?? 'Erro ao criar sala.');
      setLoading(false);
    };

    const cleanup = () => {
      networkManager.off('room-created', onCreated);
      networkManager.off('error', onError);
    };

    networkManager.on('room-created', onCreated);
    networkManager.on('error', onError);

    try {
      networkManager.send('create-room', payload);
    } catch {
      cleanup();
      setServerError('Sem conexao com o servidor.');
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!inviteCode) return;
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* */ }
  };

  const handleEnterRoom = () => {
    if (onRoomCreated && createdRoomId && inviteCode && user) {
      onRoomCreated({
        roomId: createdRoomId,
        roomName: name.trim(),
        members: [{ userId: user.id, nickname: user.nickname }],
        hostId: user.id,
        inviteCode,
        tunnel: createdTunnel ?? undefined,
      });
    } else {
      onBack();
    }
  };

  if (inviteCode) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <button className={styles.backBtn} onClick={onBack} data-testid="back-btn">Voltar</button>
          <h1 className={styles.title}>Sala criada</h1>
        </header>
        <div className={styles.content}>
          <div className={styles.card}>
            <div className={styles.result}>
              <h2 className={styles.resultTitle}>Sala criada com sucesso</h2>
              <p className={styles.resultSub}>Compartilhe o codigo de convite:</p>
              <div className={styles.codeBox}>
                <span className={styles.codeText} data-testid="invite-code">{inviteCode}</span>
                <button className={`${styles.copyBtn} ${copied ? styles.copied : ''}`} onClick={handleCopy} data-testid="copy-btn">
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
              </div>
              <div className={styles.resultActions}>
                <button className={styles.submitBtn} onClick={handleEnterRoom}>Entrar na sala</button>
                <button className={styles.backBtn} onClick={onBack}>Voltar ao dashboard</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={onBack} data-testid="back-btn">Voltar</button>
        <h1 className={styles.title}>Criar Sala</h1>
      </header>
      <div className={styles.content}>
        <div className={styles.card}>
          {serverError && <p className={styles.errorText} role="alert">{serverError}</p>}
          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="room-name">Nome da Sala *</label>
              <input id="room-name" className={`${styles.input} ${nameError ? styles.inputError : ''}`} type="text" placeholder="Ex: Minecraft com amigos" value={name} onChange={(e) => setName(e.target.value)} data-testid="room-name-input" />
              {nameError && <p className={styles.errorText} data-testid="name-error">{nameError}</p>}
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="room-password">Senha (opcional)</label>
              <input id="room-password" className={styles.input} type="password" placeholder="Deixe vazio para sala publica" value={password} onChange={(e) => setPassword(e.target.value)} data-testid="room-password-input" />
            </div>
            <div className={styles.sliderGroup}>
              <label className={styles.label} htmlFor="room-max-players">Limite de Jogadores</label>
              <div className={styles.sliderRow}>
                <input id="room-max-players" className={styles.slider} type="range" min={MIN_PLAYERS} max={MAX_PLAYERS} value={maxPlayers} onChange={(e) => setMaxPlayers(Number(e.target.value))} data-testid="max-players-slider" />
                <span className={styles.sliderValue} data-testid="max-players-value">{maxPlayers}</span>
              </div>
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="room-game-tag">Tag de Jogo (opcional)</label>
              <input id="room-game-tag" className={styles.input} type="text" placeholder="Ex: Minecraft, CS" value={gameTag} onChange={(e) => setGameTag(e.target.value)} data-testid="game-tag-input" />
            </div>
            <button type="submit" className={styles.submitBtn} disabled={loading} data-testid="submit-btn">
              {loading ? 'Criando...' : 'Criar Sala'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateRoomPage;
