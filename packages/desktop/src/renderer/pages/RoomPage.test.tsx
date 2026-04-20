import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import RoomPage from './RoomPage';
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

const HOST_ID = 'host-1';
const MEMBER_ID = 'member-2';
const ROOM_ID = 'room-abc';

const defaultProps = {
  roomId: ROOM_ID,
  roomName: 'Minecraft Fun',
  members: [
    { userId: HOST_ID, nickname: 'HostPlayer' },
    { userId: MEMBER_ID, nickname: 'GuestPlayer' },
  ],
  hostId: HOST_ID,
  inviteCode: 'INV123',
  onBack: vi.fn(),
};

function setAuth(userId: string) {
  useAuthStore.getState().setAuth('test-token', {
    id: userId,
    nickname: userId === HOST_ID ? 'HostPlayer' : 'GuestPlayer',
    avatarInitials: 'HP',
    isGuest: false,
  });
}

beforeEach(() => {
  mockManager._handlers.clear();
  vi.mocked(mockManager.send).mockClear();
  vi.mocked(mockManager.on).mockClear();
  vi.mocked(mockManager.off).mockClear();
  defaultProps.onBack.mockClear();
});

afterEach(() => {
  useAuthStore.getState().logout();
});

describe('RoomPage', () => {
  it('renders room name and status badge', () => {
    setAuth(HOST_ID);
    render(<RoomPage {...defaultProps} />);

    expect(screen.getByText('Minecraft Fun')).toBeInTheDocument();
    expect(screen.getByTestId('room-status')).toHaveTextContent('Aguardando');
  });

  it('renders member list with all members', () => {
    setAuth(HOST_ID);
    render(<RoomPage {...defaultProps} />);

    expect(screen.getByText('Membros (2)')).toBeInTheDocument();
    expect(screen.getAllByTestId('member-item')).toHaveLength(2);
    expect(screen.getByText(/HostPlayer/)).toBeInTheDocument();
    expect(screen.getByText('GuestPlayer')).toBeInTheDocument();
  });

  it('shows crown icon for host member', () => {
    setAuth(HOST_ID);
    render(<RoomPage {...defaultProps} />);

    const items = screen.getAllByTestId('member-item');
    expect(items[0].textContent).toContain('👑');
  });

  it('shows kick buttons when current user is host', () => {
    setAuth(HOST_ID);
    render(<RoomPage {...defaultProps} />);

    // Should show kick for non-host member only
    expect(screen.getByTestId(`kick-${MEMBER_ID}`)).toBeInTheDocument();
    expect(screen.queryByTestId(`kick-${HOST_ID}`)).not.toBeInTheDocument();
  });

  it('hides kick buttons when current user is NOT host', () => {
    setAuth(MEMBER_ID);
    render(<RoomPage {...defaultProps} />);

    expect(screen.queryByTestId(`kick-${HOST_ID}`)).not.toBeInTheDocument();
    expect(screen.queryByTestId(`kick-${MEMBER_ID}`)).not.toBeInTheDocument();
  });

  it('sends kick-member when kick button is clicked', async () => {
    setAuth(HOST_ID);
    const user = userEvent.setup();
    render(<RoomPage {...defaultProps} />);

    await user.click(screen.getByTestId(`kick-${MEMBER_ID}`));

    expect(mockManager.send).toHaveBeenCalledWith('kick-member', {
      roomId: ROOM_ID,
      userId: MEMBER_ID,
    });
  });

  it('renders chat input and send button', () => {
    setAuth(HOST_ID);
    render(<RoomPage {...defaultProps} />);

    expect(screen.getByTestId('chat-input')).toBeInTheDocument();
    expect(screen.getByTestId('send-btn')).toBeInTheDocument();
    expect(screen.getByTestId('send-btn')).toBeDisabled();
  });

  it('sends chat-message when form is submitted', async () => {
    setAuth(HOST_ID);
    const user = userEvent.setup();
    render(<RoomPage {...defaultProps} />);

    await user.type(screen.getByTestId('chat-input'), 'Hello world');
    await user.click(screen.getByTestId('send-btn'));

    expect(mockManager.send).toHaveBeenCalledWith('chat-message', {
      roomId: ROOM_ID,
      message: 'Hello world',
    });
  });

  it('clears input after sending message', async () => {
    setAuth(HOST_ID);
    const user = userEvent.setup();
    render(<RoomPage {...defaultProps} />);

    const input = screen.getByTestId('chat-input');
    await user.type(input, 'Hello');
    await user.click(screen.getByTestId('send-btn'));

    expect(input).toHaveValue('');
  });

  it('displays incoming chat messages', () => {
    setAuth(HOST_ID);
    render(<RoomPage {...defaultProps} />);

    act(() => {
      mockManager._dispatch('chat-message', {
        roomId: ROOM_ID,
        userId: MEMBER_ID,
        nickname: 'GuestPlayer',
        message: 'Hey there!',
        timestamp: new Date().toISOString(),
      });
    });

    expect(screen.getByText('Hey there!')).toBeInTheDocument();
    // GuestPlayer appears in both member list and chat message
    const chatMessages = screen.getByTestId('chat-messages');
    expect(chatMessages).toHaveTextContent('GuestPlayer');
    expect(chatMessages).toHaveTextContent('Hey there!');
  });

  it('ignores chat messages from other rooms', () => {
    setAuth(HOST_ID);
    render(<RoomPage {...defaultProps} />);

    act(() => {
      mockManager._dispatch('chat-message', {
        roomId: 'other-room',
        userId: 'u99',
        nickname: 'Other',
        message: 'Wrong room',
        timestamp: new Date().toISOString(),
      });
    });

    expect(screen.queryByText('Wrong room')).not.toBeInTheDocument();
  });

  it('adds member on member-joined event', () => {
    setAuth(HOST_ID);
    render(<RoomPage {...defaultProps} />);

    act(() => {
      mockManager._dispatch('member-joined', {
        roomId: ROOM_ID,
        userId: 'new-user',
        nickname: 'NewPlayer',
      });
    });

    expect(screen.getByText('Membros (3)')).toBeInTheDocument();
    expect(screen.getByText('NewPlayer')).toBeInTheDocument();
  });

  it('removes member on member-left event', () => {
    setAuth(HOST_ID);
    render(<RoomPage {...defaultProps} />);

    act(() => {
      mockManager._dispatch('member-left', {
        roomId: ROOM_ID,
        userId: MEMBER_ID,
      });
    });

    expect(screen.getByText('Membros (1)')).toBeInTheDocument();
  });

  it('calls onBack when kicked user is current user', () => {
    setAuth(MEMBER_ID);
    render(<RoomPage {...defaultProps} />);

    act(() => {
      mockManager._dispatch('member-kicked', {
        roomId: ROOM_ID,
        kickedUserId: MEMBER_ID,
      });
    });

    expect(defaultProps.onBack).toHaveBeenCalled();
  });

  it('removes member on member-kicked event for other user', () => {
    setAuth(HOST_ID);
    render(<RoomPage {...defaultProps} />);

    act(() => {
      mockManager._dispatch('member-kicked', {
        roomId: ROOM_ID,
        kickedUserId: MEMBER_ID,
      });
    });

    expect(screen.getByText('Membros (1)')).toBeInTheDocument();
  });

  it('sends leave-room and calls onBack when leave button is clicked', async () => {
    setAuth(HOST_ID);
    const user = userEvent.setup();
    render(<RoomPage {...defaultProps} />);

    await user.click(screen.getByTestId('leave-btn'));

    expect(mockManager.send).toHaveBeenCalledWith('leave-room', { roomId: ROOM_ID });
    expect(defaultProps.onBack).toHaveBeenCalled();
  });

  it('renders copy IP button with placeholder IP', () => {
    setAuth(HOST_ID);
    render(<RoomPage {...defaultProps} />);

    const btn = screen.getByTestId('copy-ip-btn');
    expect(btn).toHaveTextContent('Copiar IP Virtual (10.0.0.1)');
  });

  it('registers and cleans up WebSocket handlers', () => {
    setAuth(HOST_ID);
    const { unmount } = render(<RoomPage {...defaultProps} />);

    expect(mockManager.on).toHaveBeenCalledWith('chat-message', expect.any(Function));
    expect(mockManager.on).toHaveBeenCalledWith('member-joined', expect.any(Function));
    expect(mockManager.on).toHaveBeenCalledWith('member-left', expect.any(Function));
    expect(mockManager.on).toHaveBeenCalledWith('member-kicked', expect.any(Function));

    unmount();

    expect(mockManager.off).toHaveBeenCalledWith('chat-message', expect.any(Function));
    expect(mockManager.off).toHaveBeenCalledWith('member-joined', expect.any(Function));
    expect(mockManager.off).toHaveBeenCalledWith('member-left', expect.any(Function));
    expect(mockManager.off).toHaveBeenCalledWith('member-kicked', expect.any(Function));
  });
});
