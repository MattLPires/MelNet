import { describe, it, expect, vi, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from './database';

// Mock electron ipcMain
const handlers = new Map<string, (...args: unknown[]) => unknown>();
vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler);
    },
  },
}));

// Import after mock is set up
import { registerDbIpcHandlers } from './ipc-handlers';

describe('registerDbIpcHandlers', () => {
  let db: Database.Database;

  beforeEach(() => {
    handlers.clear();
    db = new Database(':memory:');
    runMigrations(db);
    registerDbIpcHandlers(db);
  });

  it('registers all expected IPC channels', () => {
    const expectedChannels = [
      'db:preferences:get-all',
      'db:preferences:set',
      'db:session:save',
      'db:session:get',
      'db:session:clear',
      'db:room-history:save',
      'db:room-history:list',
    ];
    for (const channel of expectedChannels) {
      expect(handlers.has(channel), `missing handler for ${channel}`).toBe(true);
    }
  });

  it('preferences:get-all returns empty object initially', () => {
    const handler = handlers.get('db:preferences:get-all')!;
    expect(handler({})).toEqual({});
  });

  it('preferences:set and get-all round-trips', () => {
    const setHandler = handlers.get('db:preferences:set')!;
    const getAllHandler = handlers.get('db:preferences:get-all')!;

    setHandler({}, 'theme', 'dark');
    setHandler({}, 'notifications', 'true');

    expect(getAllHandler({})).toEqual({ theme: 'dark', notifications: 'true' });
  });

  it('session:save and get round-trips', () => {
    const saveHandler = handlers.get('db:session:save')!;
    const getHandler = handlers.get('db:session:get')!;

    const session = {
      userId: 'u1',
      nickname: 'Mel',
      token: 'jwt-123',
      isGuest: false,
      createdAt: '2025-01-01T00:00:00Z',
    };

    saveHandler({}, session);
    expect(getHandler({})).toEqual(session);
  });

  it('session:clear removes session', () => {
    const saveHandler = handlers.get('db:session:save')!;
    const getHandler = handlers.get('db:session:get')!;
    const clearHandler = handlers.get('db:session:clear')!;

    saveHandler({}, {
      userId: 'u1',
      nickname: 'Guest',
      token: 'tok',
      isGuest: true,
      createdAt: '2025-01-01T00:00:00Z',
    });

    clearHandler({});
    expect(getHandler({})).toBeNull();
  });

  it('room-history:save and list round-trips', () => {
    const saveHandler = handlers.get('db:room-history:save')!;
    const listHandler = handlers.get('db:room-history:list')!;

    const entry = {
      id: 'r1',
      name: 'Minecraft Night',
      inviteCode: 'ABC123',
      gameTag: 'minecraft',
      joinedAt: '2025-01-01T20:00:00Z',
    };

    saveHandler({}, entry);
    const list = listHandler({}) as unknown[];
    expect(list).toHaveLength(1);
    expect(list[0]).toEqual(entry);
  });
});
