import React, { useState, useEffect } from 'react';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import CreateRoomPage from './pages/CreateRoomPage';
import RoomPage from './pages/RoomPage';
import SettingsPage from './pages/SettingsPage';
import TitleBar from './components/TitleBar';
import type { RoomMember } from './pages/RoomPage';
import { useAuthStore } from './store/authStore';
import { networkManager } from './network/NetworkManager';
import { applyTheme } from './hooks/useTheme';

export type AppPage = 'dashboard' | 'create-room' | 'room' | 'settings';

export interface RoomPageState {
  roomId: string;
  roomName: string;
  members: RoomMember[];
  hostId: string;
  inviteCode: string;
  tunnel?: {
    virtualIp: string;
    relayHost: string;
    relayPort: number;
    tunnelKey: string;
  };
}

const DEFAULT_SERVER_URL = 'wss://melnet.onrender.com';

const App: React.FC = () => {
  const { isAuthenticated, isLoading, setAuth, setLoading } = useAuthStore();
  const [page, setPage] = useState<AppPage>('dashboard');
  const [roomState, setRoomState] = useState<RoomPageState | null>(null);

  // Restore session + theme on startup
  useEffect(() => {
    (async () => {
      try {
        const prefs = await window.melnetDb?.preferences.getAll();
        const dark = !prefs || prefs.darkTheme === undefined || prefs.darkTheme === 'true';
        applyTheme(dark);
      } catch {
        applyTheme(true);
      }

      try {
        const session = await window.melnetDb?.session.get();
        if (session && session.token && !session.isGuest) {
          // Connect to server
          try {
            await networkManager.connect(DEFAULT_SERVER_URL);
            // Re-authenticate by sending the token so the server knows who we are
            networkManager.send('auth-restore', { token: session.token });
          } catch { /* server offline */ }
          setAuth(session.token, {
            id: session.userId,
            nickname: session.nickname,
            avatarInitials: session.nickname.slice(0, 2).toUpperCase(),
            isGuest: false,
          });
          return;
        }
      } catch { /* DB not available */ }

      setLoading(false);
    })();
  }, [setAuth, setLoading]);

  const navigateToRoom = (state: RoomPageState) => {
    setRoomState(state);
    setPage('room');
  };

  if (isLoading) {
    return (
      <><TitleBar />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', paddingTop: 32, background: 'var(--color-bg)', color: 'var(--color-text-muted)', fontFamily: 'Inter, sans-serif', fontSize: '0.85rem' }}>
          Carregando...
        </div>
      </>
    );
  }

  if (!isAuthenticated) {
    return <><TitleBar /><AuthPage /></>;
  }

  if (page === 'settings') {
    return <><TitleBar /><SettingsPage onBack={() => setPage('dashboard')} /></>;
  }

  if (page === 'create-room') {
    return <><TitleBar /><CreateRoomPage onBack={() => setPage('dashboard')} onRoomCreated={navigateToRoom} /></>;
  }

  if (page === 'room' && roomState) {
    return (
      <><TitleBar /><RoomPage
        roomId={roomState.roomId}
        roomName={roomState.roomName}
        members={roomState.members}
        hostId={roomState.hostId}
        inviteCode={roomState.inviteCode}
        tunnel={roomState.tunnel}
        onBack={() => {
          setRoomState(null);
          setPage('dashboard');
        }}
      /></>
    );
  }

  return <><TitleBar /><DashboardPage onNavigate={setPage} onNavigateToRoom={navigateToRoom} /></>;
};

export default App;
