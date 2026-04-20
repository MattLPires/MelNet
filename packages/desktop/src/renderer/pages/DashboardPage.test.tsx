import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import DashboardPage, { PublicRoom } from './DashboardPage';
import { useAuthStore } from '../store/authStore';
import { networkManager } from '../network/NetworkManager';

// Mock networkManager
vi.mock('../network/NetworkManager', () => {
  const handlers = new Map<string, Array<(msg: any) => void>>();
  return {
    networkManager: {
      get connected() {
        return true;
      },
      send: vi.fn(),
      on: vi.fn((type: string, handler: (msg: any) => void) => {
        const list = handlers.get(type) ?? [];
        list.push(handler);
        handlers.set(type, list);
      }),
      off: vi.fn((type: string, handler: (msg: any) => void) => {
        const list = handlers.get(type) ?? [];
        handlers.set(type, list.filter((h) => h !== handler));
      }),
      disconnect: vi.fn(),
      _handlers: handlers,
      _dispatch(type: string, payload: Record<string, unknown>) {
        const list = handlers.get(type) ?? [];
        list.forEach((h) => h({ type, payload }));
      },
    },
    ServerMessage: {},
  };
});

const mockManager = networkManager as any;

function setAuth(overrides?: Partial<{ nickname: string; isGuest: boolean }>) {
  useAuthStore.getState().setAuth('test-token', {
    id: 'u1',
    nickname: overrides?.nickname ?? 'TestUser',
    avatarInitials: 'TU',
    isGuest: overrides?.isGuest ?? false,
  });
}

const sampleRooms: PublicRoom[] = [
  {
    id: 'r1',
    name: 'Minecraft Fun',
    hasPassword: false,
    maxPlayers: 8,
    gameTag: 'Minecraft',
    hostId: 'h1',
    inviteCode: 'ABC123',
    status: 'waiting',
    members: [{ userId: 'h1', nickname: 'Host1' }],
  },
  {
    id: 'r2',
    name: 'CS Private',
    hasPassword: true,
    maxPlayers: 10,
    gameTag: 'CS',
    hostId: 'h2',
    inviteCode: 'XYZ789',
    status: 'playing',
    members: [
      { userId: 'h2', nickname: 'Host2' },
      { userId: 'u2', nickname: 'Player2' },
    ],
  },
];

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  mockManager._handlers.clear();
  vi.mocked(mockManager.send).mockClear();
  vi.mocked(mockManager.disconnect).mockClear();
});

afterEach(() => {
  useAuthStore.getState().logout();
  vi.useRealTimers();
});

describe('DashboardPage', () => {
  it('renders header with logo, connection status, and user nickname', () => {
    setAuth({ nickname: 'Abelha' });
    render(<DashboardPage />);

    expect(screen.getByText('MelNet')).toBeInTheDocument();
    expect(screen.getByText('Abelha')).toBeInTheDocument();
    expect(screen.getByTestId('connection-status')).toBeInTheDocument();
    expect(screen.getByText('Conectado')).toBeInTheDocument();
  });

  it('renders bee icon with connected animation', () => {
    setAuth();
    render(<DashboardPage />);

    const bee = screen.getByLabelText('Conectado');
    expect(bee).toHaveTextContent('🐝');
  });

  it('renders ping display when connected', () => {
    setAuth();
    render(<DashboardPage />);

    expect(screen.getByTestId('ping-display')).toBeInTheDocument();
  });

  it('renders "Criar Sala" and "Entrar com Código" buttons', () => {
    setAuth();
    render(<DashboardPage />);

    expect(screen.getByTestId('create-room-btn')).toHaveTextContent('Criar Sala');
    expect(screen.getByTestId('join-code-btn')).toHaveTextContent('Entrar com Código');
  });

  it('shows empty state when no rooms are available', () => {
    setAuth();
    render(<DashboardPage />);

    expect(screen.getByTestId('empty-rooms')).toBeInTheDocument();
    expect(screen.getByText('Nenhuma sala disponível no momento.')).toBeInTheDocument();
  });

  it('displays room list when rooms are received via WebSocket', () => {
    setAuth();
    render(<DashboardPage />);

    act(() => {
      mockManager._dispatch('room-list', { rooms: sampleRooms });
    });

    expect(screen.getByTestId('room-list')).toBeInTheDocument();
    expect(screen.getAllByTestId('room-card')).toHaveLength(2);
    expect(screen.getByText('Minecraft Fun')).toBeInTheDocument();
    expect(screen.getByText('CS Private')).toBeInTheDocument();
  });

  it('shows player count and game tag for each room', () => {
    setAuth();
    render(<DashboardPage />);

    act(() => {
      mockManager._dispatch('room-list', { rooms: sampleRooms });
    });

    expect(screen.getByText('1/8 jogadores')).toBeInTheDocument();
    expect(screen.getByText('2/10 jogadores')).toBeInTheDocument();
    expect(screen.getByText('Minecraft')).toBeInTheDocument();
    expect(screen.getByText('CS')).toBeInTheDocument();
  });

  it('shows lock icon for password-protected rooms', () => {
    setAuth();
    render(<DashboardPage />);

    act(() => {
      mockManager._dispatch('room-list', { rooms: sampleRooms });
    });

    // CS Private has hasPassword: true
    const cards = screen.getAllByTestId('room-card');
    expect(cards[1].textContent).toContain('🔒');
  });

  it('shows room status labels in Portuguese', () => {
    setAuth();
    render(<DashboardPage />);

    act(() => {
      mockManager._dispatch('room-list', { rooms: sampleRooms });
    });

    expect(screen.getByText('Aguardando')).toBeInTheDocument();
    expect(screen.getByText('Em jogo')).toBeInTheDocument();
  });

  it('sends list-rooms on mount', () => {
    setAuth();
    render(<DashboardPage />);

    expect(mockManager.send).toHaveBeenCalledWith('list-rooms', {});
  });

  it('shows guest banner for guest users', () => {
    setAuth({ isGuest: true });
    render(<DashboardPage />);

    expect(screen.getByRole('status')).toHaveTextContent('Sessão temporária');
  });

  it('calls disconnect and logout when Sair is clicked', async () => {
    setAuth();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<DashboardPage />);

    await user.click(screen.getByText('Sair'));

    expect(mockManager.disconnect).toHaveBeenCalled();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('registers WebSocket handlers on mount and cleans up on unmount', () => {
    setAuth();
    const { unmount } = render(<DashboardPage />);

    expect(mockManager.on).toHaveBeenCalledWith('room-list', expect.any(Function));
    expect(mockManager.on).toHaveBeenCalledWith('room-created', expect.any(Function));

    unmount();

    expect(mockManager.off).toHaveBeenCalledWith('room-list', expect.any(Function));
    expect(mockManager.off).toHaveBeenCalledWith('room-created', expect.any(Function));
  });
});
