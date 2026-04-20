import React, { useEffect, useState, useCallback, useRef } from 'react';
import styles from './DashboardPage.module.css';
import { networkManager, ServerMessage } from '../network/NetworkManager';
import { useAuthStore } from '../store/authStore';
import type { AppPage, RoomPageState } from '../App';

export interface PublicRoom {
  id: string;
  name: string;
  hasPassword: boolean;
  maxPlayers: number;
  gameTag: string;
  hostId: string;
  inviteCode: string;
  status: 'waiting' | 'playing' | 'closed';
  members: { userId: string; nickname: string }[];
}

interface DashboardPageProps {
  onNavigate?: (page: AppPage) => void;
  onNavigateToRoom?: (state: RoomPageState) => void;
}

const REFRESH_INTERVAL_MS = 10_000;

const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate, onNavigateToRoom }) => {
  const { user, logout } = useAuthStore();
  const [publicRooms, setPublicRooms] = useState<PublicRoom[]>([]);
  const [myRooms, setMyRooms] = useState<PublicRoom[]>([]);
  const [connected, setConnected] = useState(networkManager.connected);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchRooms = useCallback(() => {
    if (!networkManager.connected) return;
    try {
      networkManager.send('list-rooms', {});
      networkManager.send('my-rooms', {});
    } catch { /* */ }
  }, []);

  useEffect(() => {
    const handleRoomList = (msg: ServerMessage) => {
      const payload = msg.payload as { rooms?: PublicRoom[] };
      if (Array.isArray(payload.rooms)) setPublicRooms(payload.rooms);
    };
    const handleMyRooms = (msg: ServerMessage) => {
      const payload = msg.payload as { rooms?: PublicRoom[] };
      if (Array.isArray(payload.rooms)) setMyRooms(payload.rooms);
    };
    const refresh = () => fetchRooms();

    networkManager.on('room-list', handleRoomList);
    networkManager.on('my-rooms', handleMyRooms);
    networkManager.on('room-created', refresh);
    networkManager.on('member-kicked', refresh);
    networkManager.on('room-left', refresh);
    networkManager.on('room-joined', refresh);
    fetchRooms();
    intervalRef.current = setInterval(fetchRooms, REFRESH_INTERVAL_MS);
    return () => {
      networkManager.off('room-list', handleRoomList);
      networkManager.off('my-rooms', handleMyRooms);
      networkManager.off('room-created', refresh);
      networkManager.off('member-kicked', refresh);
      networkManager.off('room-left', refresh);
      networkManager.off('room-joined', refresh);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchRooms]);

  useEffect(() => {
    const check = () => setConnected(networkManager.connected);
    const id = setInterval(check, 2000);
    return () => clearInterval(id);
  }, []);

  const handleLogout = () => { networkManager.disconnect(); logout(); };

  const enterRoom = (room: PublicRoom) => {
    onNavigateToRoom?.({
      roomId: room.id,
      roomName: room.name,
      members: room.members,
      hostId: room.hostId,
      inviteCode: room.inviteCode,
    });
  };

  const RoomCard = ({ room, showEnter }: { room: PublicRoom; showEnter?: boolean }) => (
    <div className={styles.roomCard} data-testid="room-card" onClick={() => showEnter && enterRoom(room)}>
      <div className={styles.roomInfo}>
        <div className={styles.roomNameRow}>
          {room.hasPassword && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.2"><rect x="2" y="5.5" width="8" height="5" rx="1"/><path d="M4 5.5V4a2 2 0 014 0v1.5"/></svg>
          )}
          <span className={styles.roomName}>{room.name}</span>
          {room.hostId === user?.id && <span className={styles.hostBadge}>host</span>}
        </div>
        <div className={styles.roomMeta}>
          <span>{room.members.length}/{room.maxPlayers}</span>
          {room.gameTag && <span className={styles.tag}>{room.gameTag}</span>}
          <span className={room.status === 'waiting' ? styles.statusWaiting : styles.statusPlaying}>
            {room.status === 'waiting' ? 'Aguardando' : 'Em jogo'}
          </span>
        </div>
      </div>
      {showEnter && (
        <button className={styles.enterBtn} onClick={(e) => { e.stopPropagation(); enterRoom(room); }}>
          Entrar
        </button>
      )}
    </div>
  );

  return (
    <div className={styles.page}>
      {user?.isGuest && <div className={styles.guestBanner} role="status">Sessao temporaria</div>}

      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <svg width="20" height="20" viewBox="0 0 40 40"><polygon points="20,4 35,12 35,28 20,36 5,28 5,12" fill="none" stroke="var(--color-accent)" strokeWidth="2"/></svg>
          <h1 className={styles.logo}>MelNet</h1>
          <div className={styles.status}>
            <span className={`${styles.statusDot} ${connected ? styles.online : styles.offline}`}/>
            <span className={styles.statusText}>{connected ? 'Online' : 'Offline'}</span>
          </div>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.userName}>{user?.nickname}</span>
          <button className={styles.iconBtn} onClick={() => onNavigate?.('settings')} aria-label="Configuracoes" data-testid="settings-btn">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><circle cx="8" cy="8" r="2.5"/><path d="M8 1v2m0 10v2m-5-7H1m14 0h-2M3.05 3.05l1.41 1.41m7.08 7.08l1.41 1.41M3.05 12.95l1.41-1.41m7.08-7.08l1.41-1.41"/></svg>
          </button>
          <button className={styles.textBtn} onClick={handleLogout}>Sair</button>
        </div>
      </header>

      <main className={styles.content}>
        <div className={styles.actions}>
          <button className={styles.primaryBtn} onClick={() => onNavigate?.('create-room')} data-testid="create-room-btn">Criar Sala</button>
          <button className={styles.secondaryBtn} data-testid="join-code-btn">Entrar com Codigo</button>
        </div>

        {/* My Rooms */}
        {myRooms.length > 0 && (
          <>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Minhas salas</h2>
              <span className={styles.roomCount}>{myRooms.length}</span>
            </div>
            <div className={styles.roomList}>
              {myRooms.map((room) => <RoomCard key={room.id} room={room} showEnter />)}
            </div>
            <div className={styles.divider}/>
          </>
        )}

        {/* Public Rooms */}
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Salas publicas</h2>
          <span className={styles.roomCount}>{publicRooms.length}</span>
        </div>

        {publicRooms.length === 0 ? (
          <div className={styles.empty} data-testid="empty-rooms">
            <svg width="40" height="40" viewBox="0 0 40 40" opacity="0.15"><polygon points="20,4 35,12 35,28 20,36 5,28 5,12" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg>
            <p>Nenhuma sala publica disponivel</p>
            <p className={styles.emptyHint}>Crie uma sala para comecar</p>
          </div>
        ) : (
          <div className={styles.roomList} data-testid="room-list">
            {publicRooms.map((room) => <RoomCard key={room.id} room={room} />)}
          </div>
        )}
      </main>
    </div>
  );
};

export default DashboardPage;
