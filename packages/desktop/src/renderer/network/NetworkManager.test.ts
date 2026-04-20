import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NetworkManager } from './NetworkManager';

// --- Mock WebSocket ---
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onerror: ((e: any) => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  sent: string[] = [];

  constructor(public url: string) {
    // Auto-open on next tick
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.();
    }, 0);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  // Test helper: simulate server message
  simulateMessage(msg: object) {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }

  // Test helper: simulate error
  simulateError() {
    this.onerror?.({});
  }
}

let mockInstances: MockWebSocket[] = [];

beforeEach(() => {
  mockInstances = [];
  (globalThis as any).WebSocket = class extends MockWebSocket {
    constructor(url: string) {
      super(url);
      mockInstances.push(this);
    }
  };
  // Expose constants on the global mock
  (globalThis as any).WebSocket.OPEN = MockWebSocket.OPEN;
  (globalThis as any).WebSocket.CONNECTING = MockWebSocket.CONNECTING;
  (globalThis as any).WebSocket.CLOSING = MockWebSocket.CLOSING;
  (globalThis as any).WebSocket.CLOSED = MockWebSocket.CLOSED;
});

afterEach(() => {
  delete (globalThis as any).WebSocket;
});

function lastMock(): MockWebSocket {
  return mockInstances[mockInstances.length - 1];
}

describe('NetworkManager', () => {
  let nm: NetworkManager;

  beforeEach(() => {
    nm = new NetworkManager();
  });

  afterEach(() => {
    nm.disconnect();
  });

  it('connects to the server', async () => {
    await nm.connect('ws://localhost:3001');
    expect(nm.connected).toBe(true);
    expect(nm.url).toBe('ws://localhost:3001');
  });

  it('rejects on connection error', async () => {
    // Override to simulate error without auto-open
    (globalThis as any).WebSocket = class {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;
      readyState = 0;
      onopen: (() => void) | null = null;
      onerror: ((e: any) => void) | null = null;
      onmessage: ((e: { data: string }) => void) | null = null;
      onclose: (() => void) | null = null;
      url: string;
      constructor(url: string) {
        this.url = url;
        setTimeout(() => {
          this.readyState = 3;
          this.onerror?.({});
        }, 0);
      }
      send() {}
      close() { this.readyState = 3; this.onclose?.(); }
    };
    (globalThis as any).WebSocket.OPEN = 1;
    (globalThis as any).WebSocket.CONNECTING = 0;

    await expect(nm.connect('ws://bad')).rejects.toThrow('WebSocket connection failed');
  });

  it('disconnect closes the socket', async () => {
    await nm.connect('ws://localhost:3001');
    nm.disconnect();
    expect(nm.connected).toBe(false);
    expect(nm.url).toBeNull();
  });

  it('register sends correct message and resolves on success', async () => {
    await nm.connect('ws://localhost:3001');
    const ws = lastMock();

    const promise = nm.register('Mel', 'mel@test.com', 'secret');

    // Verify sent message
    const sent = JSON.parse(ws.sent[0]);
    expect(sent.type).toBe('register');
    expect(sent.payload).toEqual({ nickname: 'Mel', email: 'mel@test.com', password: 'secret' });

    // Simulate server response
    ws.simulateMessage({
      type: 'register-success',
      payload: {
        token: 'jwt-123',
        user: { id: '1', nickname: 'Mel', avatarInitials: 'ME', isGuest: false },
      },
    });

    const result = await promise;
    expect(result.token).toBe('jwt-123');
    expect(result.user.nickname).toBe('Mel');
  });

  it('login sends correct message and resolves on success', async () => {
    await nm.connect('ws://localhost:3001');
    const ws = lastMock();

    const promise = nm.login('mel@test.com', 'secret');

    const sent = JSON.parse(ws.sent[0]);
    expect(sent.type).toBe('login');
    expect(sent.payload).toEqual({ email: 'mel@test.com', password: 'secret' });

    ws.simulateMessage({
      type: 'login-success',
      payload: {
        token: 'jwt-456',
        user: { id: '2', nickname: 'Mel', avatarInitials: 'ME', isGuest: false },
      },
    });

    const result = await promise;
    expect(result.token).toBe('jwt-456');
  });

  it('guestLogin sends correct message and resolves on success', async () => {
    await nm.connect('ws://localhost:3001');
    const ws = lastMock();

    const promise = nm.guestLogin('GuestBee');

    const sent = JSON.parse(ws.sent[0]);
    expect(sent.type).toBe('guest-login');
    expect(sent.payload).toEqual({ nickname: 'GuestBee' });

    ws.simulateMessage({
      type: 'guest-login-success',
      payload: {
        token: 'guest-jwt',
        user: { id: 'g1', nickname: 'GuestBee', avatarInitials: 'GU', isGuest: true },
      },
    });

    const result = await promise;
    expect(result.token).toBe('guest-jwt');
    expect(result.user.isGuest).toBe(true);
  });

  it('rejects auth on server error response', async () => {
    await nm.connect('ws://localhost:3001');
    const ws = lastMock();

    const promise = nm.login('bad@test.com', 'wrong');

    ws.simulateMessage({
      type: 'error',
      payload: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' },
    });

    await expect(promise).rejects.toThrow('Invalid credentials');
  });

  it('rejects auth when not connected', () => {
    expect(() => nm.send('test', {})).toThrow('WebSocket is not connected');
    expect(nm.login('a@b.com', 'x')).rejects.toThrow('WebSocket is not connected');
  });

  it('on/off registers and removes handlers', async () => {
    await nm.connect('ws://localhost:3001');
    const ws = lastMock();
    const handler = vi.fn();

    nm.on('custom-event', handler);
    ws.simulateMessage({ type: 'custom-event', payload: { data: 1 } });
    expect(handler).toHaveBeenCalledTimes(1);

    nm.off('custom-event', handler);
    ws.simulateMessage({ type: 'custom-event', payload: { data: 2 } });
    expect(handler).toHaveBeenCalledTimes(1); // not called again
  });
});
