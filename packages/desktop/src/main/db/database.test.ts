import Database from 'better-sqlite3';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runMigrations } from './database';

describe('database', () => {
  let db: Database.Database;

  beforeEach(() => {
    // Use in-memory database for tests
    db = new Database(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  describe('runMigrations', () => {
    it('should create preferences table', () => {
      runMigrations(db);

      const table = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='preferences'")
        .get() as { name: string } | undefined;

      expect(table).toBeDefined();
      expect(table!.name).toBe('preferences');
    });

    it('should create room_history table', () => {
      runMigrations(db);

      const table = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='room_history'")
        .get() as { name: string } | undefined;

      expect(table).toBeDefined();
      expect(table!.name).toBe('room_history');
    });

    it('should create user_session table', () => {
      runMigrations(db);

      const table = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user_session'")
        .get() as { name: string } | undefined;

      expect(table).toBeDefined();
      expect(table!.name).toBe('user_session');
    });

    it('should be idempotent — running migrations twice does not throw', () => {
      runMigrations(db);
      expect(() => runMigrations(db)).not.toThrow();
    });
  });

  describe('preferences table schema', () => {
    beforeEach(() => runMigrations(db));

    it('should insert and retrieve a preference', () => {
      db.prepare('INSERT INTO preferences (key, value) VALUES (?, ?)').run('theme', 'dark');

      const row = db.prepare('SELECT * FROM preferences WHERE key = ?').get('theme') as {
        key: string;
        value: string;
      };

      expect(row.key).toBe('theme');
      expect(row.value).toBe('dark');
    });

    it('should enforce primary key uniqueness on key', () => {
      db.prepare('INSERT INTO preferences (key, value) VALUES (?, ?)').run('theme', 'dark');

      expect(() =>
        db.prepare('INSERT INTO preferences (key, value) VALUES (?, ?)').run('theme', 'light'),
      ).toThrow();
    });
  });

  describe('room_history table schema', () => {
    beforeEach(() => runMigrations(db));

    it('should insert and retrieve a room history entry', () => {
      db.prepare(
        'INSERT INTO room_history (id, name, inviteCode, gameTag, joinedAt) VALUES (?, ?, ?, ?, ?)',
      ).run('room-1', 'My Room', 'ABC123', 'minecraft', '2024-01-01T00:00:00Z');

      const row = db.prepare('SELECT * FROM room_history WHERE id = ?').get('room-1') as {
        id: string;
        name: string;
        inviteCode: string;
        gameTag: string;
        joinedAt: string;
      };

      expect(row.id).toBe('room-1');
      expect(row.name).toBe('My Room');
      expect(row.inviteCode).toBe('ABC123');
      expect(row.gameTag).toBe('minecraft');
      expect(row.joinedAt).toBe('2024-01-01T00:00:00Z');
    });

    it('should enforce primary key uniqueness on id', () => {
      db.prepare(
        'INSERT INTO room_history (id, name, inviteCode, gameTag, joinedAt) VALUES (?, ?, ?, ?, ?)',
      ).run('room-1', 'Room A', 'AAA', 'cs', '2024-01-01T00:00:00Z');

      expect(() =>
        db
          .prepare(
            'INSERT INTO room_history (id, name, inviteCode, gameTag, joinedAt) VALUES (?, ?, ?, ?, ?)',
          )
          .run('room-1', 'Room B', 'BBB', 'cs', '2024-01-02T00:00:00Z'),
      ).toThrow();
    });
  });

  describe('user_session table schema', () => {
    beforeEach(() => runMigrations(db));

    it('should insert and retrieve a user session', () => {
      db.prepare(
        'INSERT INTO user_session (id, userId, nickname, token, isGuest, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(1, 'user-1', 'Player1', 'jwt-token-123', 0, '2024-01-01T00:00:00Z');

      const row = db.prepare('SELECT * FROM user_session WHERE id = ?').get(1) as {
        id: number;
        userId: string;
        nickname: string;
        token: string;
        isGuest: number;
        createdAt: string;
      };

      expect(row.id).toBe(1);
      expect(row.userId).toBe('user-1');
      expect(row.nickname).toBe('Player1');
      expect(row.token).toBe('jwt-token-123');
      expect(row.isGuest).toBe(0);
      expect(row.createdAt).toBe('2024-01-01T00:00:00Z');
    });

    it('should store guest sessions with isGuest = 1', () => {
      db.prepare(
        'INSERT INTO user_session (id, userId, nickname, token, isGuest, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(1, 'guest-1', 'GuestPlayer', 'guest-token', 1, '2024-01-01T00:00:00Z');

      const row = db.prepare('SELECT * FROM user_session WHERE id = ?').get(1) as {
        isGuest: number;
      };

      expect(row.isGuest).toBe(1);
    });
  });
});
