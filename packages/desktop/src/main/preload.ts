import { contextBridge, ipcRenderer } from 'electron';

export interface DbBridge {
  preferences: {
    getAll: () => Promise<Record<string, string>>;
    set: (key: string, value: string) => Promise<void>;
  };
  session: {
    save: (data: {
      userId: string;
      nickname: string;
      token: string;
      isGuest: boolean;
      createdAt: string;
    }) => Promise<void>;
    get: () => Promise<{
      userId: string;
      nickname: string;
      token: string;
      isGuest: boolean;
      createdAt: string;
    } | null>;
    clear: () => Promise<void>;
  };
  roomHistory: {
    save: (entry: {
      id: string;
      name: string;
      inviteCode: string;
      gameTag: string;
      joinedAt: string;
    }) => Promise<void>;
    list: () => Promise<
      Array<{
        id: string;
        name: string;
        inviteCode: string;
        gameTag: string;
        joinedAt: string;
      }>
    >;
  };
}

export interface AppBridge {
  setAutoStart: (enabled: boolean) => Promise<void>;
  getAutoStart: () => Promise<boolean>;
}

const appBridge: AppBridge = {
  setAutoStart: (enabled) => ipcRenderer.invoke('app:set-auto-start', enabled),
  getAutoStart: () => ipcRenderer.invoke('app:get-auto-start'),
};

const dbBridge: DbBridge = {
  preferences: {
    getAll: () => ipcRenderer.invoke('db:preferences:get-all'),
    set: (key, value) => ipcRenderer.invoke('db:preferences:set', key, value),
  },
  session: {
    save: (data) => ipcRenderer.invoke('db:session:save', data),
    get: () => ipcRenderer.invoke('db:session:get'),
    clear: () => ipcRenderer.invoke('db:session:clear'),
  },
  roomHistory: {
    save: (entry) => ipcRenderer.invoke('db:room-history:save', entry),
    list: () => ipcRenderer.invoke('db:room-history:list'),
  },
};

contextBridge.exposeInMainWorld('melnetDb', dbBridge);
contextBridge.exposeInMainWorld('melnetApp', appBridge);
contextBridge.exposeInMainWorld('melnetWindow', {
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
});
contextBridge.exposeInMainWorld('melnetTunnel', {
  start: (config: { virtualIp: string; subnet: string; relayHost: string; relayPort: number; tunnelKey: string }) =>
    ipcRenderer.invoke('tunnel:start', config),
  stop: () => ipcRenderer.invoke('tunnel:stop'),
  status: () => ipcRenderer.invoke('tunnel:status'),
});
