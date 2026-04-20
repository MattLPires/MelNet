import type { DbBridge, AppBridge } from '../main/preload';

declare global {
  interface Window {
    melnetDb: DbBridge;
    melnetApp: AppBridge;
    melnetWindow: {
      minimize: () => void;
      maximize: () => void;
      close: () => void;
    };
    melnetTunnel: {
      start: (config: { virtualIp: string; subnet: string; relayHost: string; relayPort: number; tunnelKey: string }) =>
        Promise<{ success: boolean; virtualIp?: string; error?: string }>;
      stop: () => Promise<{ success: boolean }>;
      status: () => Promise<{ connected: boolean; virtualIp: string }>;
    };
  }
}
