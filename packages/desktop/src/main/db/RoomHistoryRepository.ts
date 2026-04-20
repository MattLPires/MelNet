import type Database from 'better-sqlite3';

export interface RoomHistoryEntry {
  id: string;
  name: string;
  inviteCode: string;
  gameTag: string;
  joinedAt: string;
}

export class RoomHistoryRepository {
  constructor(private db: Database.Database) {}

  save(room: RoomHistoryEntry): void {
    this.db
      .prepare(
        'INSERT OR REPLACE INTO room_history (id, name, inviteCode, gameTag, joinedAt) VALUES (?, ?, ?, ?, ?)',
      )
      .run(room.id, room.name, room.inviteCode, room.gameTag, room.joinedAt);
  }

  list(): RoomHistoryEntry[] {
    return this.db
      .prepare('SELECT id, name, inviteCode, gameTag, joinedAt FROM room_history ORDER BY joinedAt DESC')
      .all() as RoomHistoryEntry[];
  }

  clear(): void {
    this.db.prepare('DELETE FROM room_history').run();
  }
}
