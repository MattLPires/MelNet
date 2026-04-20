import { app } from 'electron';

/**
 * Configures whether the app should launch automatically when the OS starts.
 * Uses Electron's built-in `app.setLoginItemSettings` which works on Windows and Linux.
 */
export function setAutoStart(enabled: boolean): void {
  app.setLoginItemSettings({ openAtLogin: enabled });
}

/**
 * Returns whether the app is currently configured to start with the OS.
 */
export function getAutoStartEnabled(): boolean {
  return app.getLoginItemSettings().openAtLogin;
}
