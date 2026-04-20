import Database from 'better-sqlite3';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runMigrations } from './database';
import { PreferencesRepository } from './PreferencesRepository';
import { RoomHistoryRepository, type RoomHistoryEntry } from './RoomHistoryRepository';
import { SessionRepository, type UserSession } from './SessionRepository';

describe('PreferencesRepository', () => {
  let db: Database.Database;
  let repo: PreferencesRepository;

  beforeEach(() => {
    db = new Database(':memory:');
    runMigrations(db);
    repo = new PreferencesRepository(db);
  });

  afterEach(() => db.close());

  it('should return null for a missing key', () => {
    expect(repo.get('nonexistent')).toBeNull();
  });

  it('should set and get a preference', () => {
    repo.set('theme', 'dark');
    expect(repo.get('theme')).toBe('dark');
  });

  it('should overwrite an existing preference', () => {
    repo.set('theme', 'dark');
    repo.set('theme', 'light');
    expect(repo.get('theme')).toBe('light');
  });

  it('should return all preferences', () => {
    repo.set('theme', 'dark');
    repo.set('networkInterface', 'eth0');
    repo.set('notifications', 'true');
    repo.set('autoStart', 'false');

    expect(repo.getAll()).toEqual({
      theme: 'dark',
      networkInterface: 'eth0',
      notifications: 'true',
      autoStart: 'false',
    });
  });

  it('should return empty object when no preferences exist', () => {
    expect(repo.getAll()).toEqual({});
  });
});

describe('RoomHistoryRepository', () => {
  let db: Database.Database;
  let repo: RoomHistoryRepository;

  const room1: RoomHistoryEntry = {
    id: 'room-1',
    name: 'CS Room',
    inviteCode: 'ABC123',
    gameTag: 'cs',
    joinedAt: '2024-01-01T00:00:00Z',
  };

  const room2: RoomHistoryEntry = {
    id: 'room-2',
    name: 'Minecraft Room',
    inviteCode: 'XYZ789',
    gameTag: 'minecraft',
    joinedAt: '2024-01-02T00:00:00Z',
  };

  beforeEach(() => {
    db = new Database(':memory:');
    runMigrations(db);
    repo = new RoomHistoryRepository(db);
  });

  afterEach(() => db.close());

  it('should return empty list when no history exists', () => {
    expect(repo.list()).toEqual([]);
  });

  it('should save and list a room', () => {
    repo.save(room1);
    expect(repo.list()).toEqual([room1]);
  });

  it('should list rooms ordered by joinedAt descending', () => {
    repo.save(room1);
    repo.save(room2);
    const list = repo.list();
    expect(list[0].id).toBe('room-2');
    expect(list[1].id).toBe('room-1');
  });

  it('should replace a room with the same id', () => {
    repo.save(room1);
    repo.save({ ...room1, name: 'Updated Room' });
    const list = repo.list();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Updated Room');
  });

  it('should clear all history', () => {
    repo.save(room1);
    repo.save(room2);
    repo.clear();
    expect(repo.list()).toEqual([]);
  });
});

describe('SessionRepository', () => {
  let db: Database.Database;
  let repo: SessionRepository;

  const session: UserSession = {
    userId: 'user-1',
    nickname: 'Player1',
    token: 'jwt-token-123',
    isGuest: false,
    createdAt: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    db = new Database(':memory:');
    runMigrations(db);
    repo = new SessionRepository(db);
  });

  afterEach(() => db.close());

  it('should return null when no session exists', () => {
    expect(repo.get()).toBeNull();
  });

  it('should save and retrieve a session', () => {
    repo.save(session);
    expect(repo.get()).toEqual(session);
  });

  it('should replace the previous session on save', () => {
    repo.save(session);
    const newSession: UserSession = {
      userId: 'user-2',
      nickname: 'Player2',
      token: 'new-token',
      isGuest: true,
      createdAt: '2024-02-01T00:00:00Z',
    };
    repo.save(newSession);
    expect(repo.get()).toEqual(newSession);
  });

  it('should correctly persist isGuest as boolean', () => {
    repo.save({ ...session, isGuest: true });
    expect(repo.get()!.isGuest).toBe(true);

    repo.save({ ...session, isGuest: false });
    expect(repo.get()!.isGuest).toBe(false);
  });

  it('should clear the session', () => {
    repo.save(session);
    repo.clear();
    expect(repo.get()).toBeNull();
  });
});
