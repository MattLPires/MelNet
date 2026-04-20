import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ModerationLog from './ModerationLog';
import { networkManager } from '../network/NetworkManager';

vi.mock('../network/NetworkManager', () => {
  const handlers = new Map<string, Array<(msg: any) => void>>();
  return {
    networkManager: {
      on: vi.fn((type: string, handler: (msg: any) => void) => {
        const list = handlers.get(type) ?? [];
        list.push(handler);
        handlers.set(type, list);
      }),
      off: vi.fn((type: string, handler: (msg: any) => void) => {
        const list = handlers.get(type) ?? [];
        handlers.set(type, list.filter((h) => h !== handler));
      }),
      _handlers: handlers,
      _dispatch(type: string, payload: Record<string, unknown>) {
        const list = handlers.get(type) ?? [];
        list.forEach((h) => h({ type, payload }));
      },
    },
  };
});

const mockManager = networkManager as any;
const ROOM_ID = 'room-abc';

beforeEach(() => {
  mockManager._handlers.clear();
  vi.mocked(mockManager.on).mockClear();
  vi.mocked(mockManager.off).mockClear();
});

describe('ModerationLog', () => {
  it('renders nothing when isHost is false', () => {
    render(<ModerationLog roomId={ROOM_ID} isHost={false} />);
    expect(screen.queryByTestId('moderation-log')).not.toBeInTheDocument();
  });

  it('renders toggle button when isHost is true', () => {
    render(<ModerationLog roomId={ROOM_ID} isHost={true} />);
    expect(screen.getByTestId('moderation-log')).toBeInTheDocument();
    expect(screen.getByTestId('moderation-log-toggle')).toHaveTextContent('Log de Moderação (0)');
  });

  it('starts collapsed and shows empty message when expanded', async () => {
    const user = userEvent.setup();
    render(<ModerationLog roomId={ROOM_ID} isHost={true} />);

    expect(screen.queryByTestId('moderation-event-list')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('moderation-log-toggle'));

    expect(screen.getByTestId('moderation-event-list')).toBeInTheDocument();
    expect(screen.getByText('Nenhum evento registrado.')).toBeInTheDocument();
  });

  it('collapses when toggle is clicked again', async () => {
    const user = userEvent.setup();
    render(<ModerationLog roomId={ROOM_ID} isHost={true} />);

    await user.click(screen.getByTestId('moderation-log-toggle'));
    expect(screen.getByTestId('moderation-event-list')).toBeInTheDocument();

    await user.click(screen.getByTestId('moderation-log-toggle'));
    expect(screen.queryByTestId('moderation-event-list')).not.toBeInTheDocument();
  });

  it('displays moderation events from WebSocket', async () => {
    const user = userEvent.setup();
    render(<ModerationLog roomId={ROOM_ID} isHost={true} />);

    act(() => {
      mockManager._dispatch('moderation-event', {
        roomId: ROOM_ID,
        event: 'port-scan-blocked',
        timestamp: '2024-01-15T10:30:00.000Z',
        details: 'Port scan attempt from 10.0.0.3 blocked',
      });
    });

    expect(screen.getByTestId('moderation-log-toggle')).toHaveTextContent('Log de Moderação (1)');

    await user.click(screen.getByTestId('moderation-log-toggle'));

    const items = screen.getAllByTestId('moderation-event-item');
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent('port-scan-blocked');
    expect(items[0]).toHaveTextContent('Port scan attempt from 10.0.0.3 blocked');
  });

  it('ignores moderation events from other rooms', () => {
    render(<ModerationLog roomId={ROOM_ID} isHost={true} />);

    act(() => {
      mockManager._dispatch('moderation-event', {
        roomId: 'other-room',
        event: 'port-scan-blocked',
        timestamp: '2024-01-15T10:30:00.000Z',
        details: 'Should not appear',
      });
    });

    expect(screen.getByTestId('moderation-log-toggle')).toHaveTextContent('Log de Moderação (0)');
  });

  it('registers and cleans up WebSocket handler', () => {
    const { unmount } = render(<ModerationLog roomId={ROOM_ID} isHost={true} />);

    expect(mockManager.on).toHaveBeenCalledWith('moderation-event', expect.any(Function));

    unmount();

    expect(mockManager.off).toHaveBeenCalledWith('moderation-event', expect.any(Function));
  });

  it('accumulates multiple events', async () => {
    const user = userEvent.setup();
    render(<ModerationLog roomId={ROOM_ID} isHost={true} />);

    act(() => {
      mockManager._dispatch('moderation-event', {
        roomId: ROOM_ID,
        event: 'port-scan-blocked',
        timestamp: '2024-01-15T10:30:00.000Z',
        details: 'First event',
      });
      mockManager._dispatch('moderation-event', {
        roomId: ROOM_ID,
        event: 'rdp-blocked',
        timestamp: '2024-01-15T10:31:00.000Z',
        details: 'Second event',
      });
    });

    expect(screen.getByTestId('moderation-log-toggle')).toHaveTextContent('Log de Moderação (2)');

    await user.click(screen.getByTestId('moderation-log-toggle'));
    expect(screen.getAllByTestId('moderation-event-item')).toHaveLength(2);
  });

  it('has correct aria-expanded attribute', async () => {
    const user = userEvent.setup();
    render(<ModerationLog roomId={ROOM_ID} isHost={true} />);

    const toggle = screen.getByTestId('moderation-log-toggle');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });
});
