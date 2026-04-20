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
  }
}
