import type Database from 'better-sqlite3';

export interface UserSession {
  userId: string;
  nickname: string;
  token: string;
  isGuest: boolean;
  createdAt: string;
}

interface SessionRow {
  id: number;
  userId: string;
  nickname: string;
  token: string;
  isGuest: number;
  createdAt: string;
}

export class SessionRepository {
  constructor(private db: Database.Database) {}

  save(session: UserSession): void {
    this.db.prepare('DELETE FROM user_session').run();
    this.db
      .prepare(
        'INSERT INTO user_session (id, userId, nickname, token, isGuest, createdAt) VALUES (1, ?, ?, ?, ?, ?)',
      )
      .run(
        session.userId,
        session.nickname,
        session.token,
        session.isGuest ? 1 : 0,
        session.createdAt,
      );
  }

  get(): UserSession | null {
    const row = this.db
      .prepare('SELECT * FROM user_session WHERE id = 1')
      .get() as SessionRow | undefined;
    if (!row) return null;
    return {
      userId: row.userId,
      nickname: row.nickname,
      token: row.token,
      isGuest: row.isGuest === 1,
      createdAt: row.createdAt,
    };
  }

  clear(): void {
    this.db.prepare('DELETE FROM user_session').run();
  }
}
