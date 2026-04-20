import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';

let dbInstance: Database.Database | null = null;

/**
 * Returns a singleton better-sqlite3 Database instance.
 * If no path is provided, defaults to `melnet.db` in the Electron userData directory.
 */
export function getDatabase(dbPath?: string): Database.Database {
  if (dbInstance) return dbInstance;

  const resolvedPath = dbPath ?? path.join(app.getPath('userData'), 'melnet.db');
  dbInstance = new Database(resolvedPath);

  // Enable WAL mode for better concurrent read performance
  dbInstance.pragma('journal_mode = WAL');

  runMigrations(dbInstance);

  return dbInstance;
}

/**
 * Creates the initial database schema if tables don't exist.
 */
export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS preferences (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS room_history (
      id TEXT PRIMARY KEY,
      name TEXT,
      inviteCode TEXT,
      gameTag TEXT,
      joinedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS user_session (
      id INTEGER PRIMARY KEY,
      userId TEXT,
      nickname TEXT,
      token TEXT,
      isGuest INTEGER,
      createdAt TEXT
    );
  `);
}

/**
 * Closes the database connection and resets the singleton.
 * Useful for cleanup in tests or app shutdown.
 */
export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Resets the singleton reference without closing.
 * Used internally for testing with custom db paths.
 */
export function _resetInstance(): void {
  dbInstance = null;
}
