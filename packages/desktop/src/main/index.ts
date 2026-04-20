import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from 'electron';
import path from 'path';
import { getDatabase, closeDatabase } from './db/database';
import { registerDbIpcHandlers } from './db/ipc-handlers';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

const isDev = !app.isPackaged;

function createTray(): void {
  const iconPath = isDev
    ? path.join(app.getAppPath(), '..', '..', 'build', 'icon.ico')
    : path.join(process.resourcesPath, 'icon.ico');

  let icon: Electron.NativeImage;
  try {
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) throw new Error('empty');
  } catch {
    // Fallback to a simple generated icon
    icon = nativeImage.createFromDataURL(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAA3ElEQVQ4T6WTwQ3CMAAE7wqgA+iADqAD6IAOoAPogA6gAzqADugAOoAO2NVKkWMnTsQpkuXz3a3t0PCjhvX/BewBnIFdKuQG4AjgkgN4ADgB2KZCHgCuAPYpgFcqZJMCeKdCNimATypkkwL4pkI2KYBfKmSTAvgPwCYF8B+ATQrgPwCbFMB/ADYpgP8AbFIA/wHYpAD+A7BJAfwHYJMC+A/AJgXwH4BNCuA/AJsUwH8ANimA/wBsUgD/AdikAP4DsEkB/AdgkwL4D8AmBfAfgE0K4D8AmxTAfwA2KYAvHxIhEfhPdJoAAAAASUVORK5CYII='
    );
  }

  tray = new Tray(icon);
  tray.setToolTip('MelNet');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Abrir MelNet',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    { type: 'separator' },
    {
      label: 'Criar Sala',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
        mainWindow?.webContents.send('navigate', 'create-room');
      },
    },
    { type: 'separator' },
    {
      label: 'Fechar MelNet',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    icon: isDev
      ? path.join(app.getAppPath(), '..', '..', 'build', 'icon.ico')
      : path.join(process.resourcesPath, 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false,
    backgroundColor: '#1A1A1A',
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Minimize to tray instead of closing
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  const db = getDatabase();
  registerDbIpcHandlers(db);

  ipcMain.on('window:minimize', () => mainWindow?.minimize());
  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.on('window:close', () => mainWindow?.hide());

  createWindow();
  createTray();
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    closeDatabase();
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    mainWindow?.show();
  }
});
