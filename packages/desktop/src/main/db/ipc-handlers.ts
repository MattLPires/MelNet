import { ipcMain } from 'electron';
import { PreferencesRepository } from './PreferencesRepository';
import { RoomHistoryRepository, type RoomHistoryEntry } from './RoomHistoryRepository';
import { SessionRepository, type UserSession } from './SessionRepository';
import { setAutoStart, getAutoStartEnabled } from '../autostart';
import { TunnelBridge, type TunnelConfig } from '../tunnel/TunnelBridge';
import type Database from 'better-sqlite3';

const tunnelBridge = new TunnelBridge();

/**
 * Registers IPC handlers that bridge the renderer process to the SQLite database.
 * Must be called once during app initialization, after the database is ready.
 */
export function registerDbIpcHandlers(db: Database.Database): void {
  const preferences = new PreferencesRepository(db);
  const roomHistory = new RoomHistoryRepository(db);
  const session = new SessionRepository(db);

  // --- Preferences ---
  ipcMain.handle('db:preferences:get-all', () => {
    return preferences.getAll();
  });

  ipcMain.handle('db:preferences:set', (_event, key: string, value: string) => {
    preferences.set(key, value);
  });

  // --- Session ---
  ipcMain.handle('db:session:save', (_event, data: UserSession) => {
    session.save(data);
  });

  ipcMain.handle('db:session:get', () => {
    return session.get();
  });

  ipcMain.handle('db:session:clear', () => {
    session.clear();
  });

  // --- Room History ---
  ipcMain.handle('db:room-history:save', (_event, entry: RoomHistoryEntry) => {
    roomHistory.save(entry);
  });

  ipcMain.handle('db:room-history:list', () => {
    return roomHistory.list();
  });

  // --- Auto-start ---
  ipcMain.handle('app:set-auto-start', (_event, enabled: boolean) => {
    setAutoStart(enabled);
  });

  ipcMain.handle('app:get-auto-start', () => {
    return getAutoStartEnabled();
  });

  // --- Tunnel ---
  ipcMain.handle('tunnel:start', async (_event, config: TunnelConfig) => {
    try {
      await tunnelBridge.start(config);
      return { success: true, virtualIp: tunnelBridge.virtualIp };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to start tunnel';
      return { success: false, error: message };
    }
  });

  ipcMain.handle('tunnel:stop', () => {
    tunnelBridge.stop();
    return { success: true };
  });

  ipcMain.handle('tunnel:status', () => {
    return { connected: tunnelBridge.isConnected, virtualIp: tunnelBridge.virtualIp };
  });
}
