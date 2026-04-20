import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreateRoomPage from './CreateRoomPage';
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

beforeEach(() => {
  mockManager._handlers.clear();
  vi.mocked(mockManager.send).mockClear();
  vi.mocked(mockManager.on).mockClear();
  vi.mocked(mockManager.off).mockClear();
});

describe('CreateRoomPage', () => {
  const onBack = vi.fn();

  it('renders form with all fields', () => {
    render(<CreateRoomPage onBack={onBack} />);

    expect(screen.getByRole('heading', { name: 'Criar Sala' })).toBeInTheDocument();
    expect(screen.getByTestId('room-name-input')).toBeInTheDocument();
    expect(screen.getByTestId('room-password-input')).toBeInTheDocument();
    expect(screen.getByTestId('max-players-slider')).toBeInTheDocument();
    expect(screen.getByTestId('game-tag-input')).toBeInTheDocument();
    expect(screen.getByTestId('submit-btn')).toBeInTheDocument();
  });

  it('shows default max players as 8', () => {
    render(<CreateRoomPage onBack={onBack} />);
    expect(screen.getByTestId('max-players-value')).toHaveTextContent('8');
  });

  it('shows validation error when name is empty on submit', async () => {
    const user = userEvent.setup();
    render(<CreateRoomPage onBack={onBack} />);

    await user.click(screen.getByTestId('submit-btn'));

    expect(screen.getByTestId('name-error')).toHaveTextContent('Nome da sala é obrigatório');
    expect(mockManager.send).not.toHaveBeenCalled();
  });

  it('sends create-room message with correct payload', async () => {
    const user = userEvent.setup();
    render(<CreateRoomPage onBack={onBack} />);

    await user.type(screen.getByTestId('room-name-input'), 'Minha Sala');
    await user.type(screen.getByTestId('room-password-input'), 'secret');
    await user.type(screen.getByTestId('game-tag-input'), 'Minecraft');
    await user.click(screen.getByTestId('submit-btn'));

    expect(mockManager.send).toHaveBeenCalledWith('create-room', {
      name: 'Minha Sala',
      password: 'secret',
      gameTag: 'Minecraft',
    });
  });

  it('shows invite code after successful room creation', async () => {
    const user = userEvent.setup();
    render(<CreateRoomPage onBack={onBack} />);

    await user.type(screen.getByTestId('room-name-input'), 'Test Room');
    await user.click(screen.getByTestId('submit-btn'));

    act(() => {
      mockManager._dispatch('room-created', {
        room: { id: 'r1', name: 'Test Room' },
        inviteCode: 'ABC123',
      });
    });

    expect(screen.getByTestId('invite-code')).toHaveTextContent('ABC123');
    expect(screen.getByTestId('copy-btn')).toBeInTheDocument();
  });

  it('copies invite code to clipboard when Copiar is clicked', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    render(<CreateRoomPage onBack={onBack} />);

    await user.type(screen.getByTestId('room-name-input'), 'Test Room');
    await user.click(screen.getByTestId('submit-btn'));

    act(() => {
      mockManager._dispatch('room-created', {
        room: { id: 'r1', name: 'Test Room' },
        inviteCode: 'XYZ789',
      });
    });

    await user.click(screen.getByTestId('copy-btn'));

    expect(writeText).toHaveBeenCalledWith('XYZ789');
    expect(screen.getByTestId('copy-btn')).toHaveTextContent('Copiado!');
  });

  it('calls onBack when back button is clicked', async () => {
    const user = userEvent.setup();
    render(<CreateRoomPage onBack={onBack} />);

    await user.click(screen.getByTestId('back-btn'));

    expect(onBack).toHaveBeenCalled();
  });

  it('shows server error on error response', async () => {
    const user = userEvent.setup();
    render(<CreateRoomPage onBack={onBack} />);

    await user.type(screen.getByTestId('room-name-input'), 'Test Room');
    await user.click(screen.getByTestId('submit-btn'));

    act(() => {
      mockManager._dispatch('error', { message: 'Nome já em uso' });
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Nome já em uso');
  });

  it('does not include optional fields when empty', async () => {
    const user = userEvent.setup();
    render(<CreateRoomPage onBack={onBack} />);

    await user.type(screen.getByTestId('room-name-input'), 'Simple Room');
    await user.click(screen.getByTestId('submit-btn'));

    expect(mockManager.send).toHaveBeenCalledWith('create-room', {
      name: 'Simple Room',
    });
  });
});
