/**
 * Singleton VirtualNetworkManager instance and tunnel credential helpers.
 *
 * Requirements: 5.5, 10.1, 10.3
 */
import { randomBytes } from "crypto";
import { VirtualNetworkManager } from "./vnet-manager";

/** Singleton vnet manager shared across the server. */
export const vnetManager = new VirtualNetworkManager();

/** Default relay configuration (overridable via env). */
export const RELAY_HOST = 'melnet-relay.fly.dev'
export const RELAY_PORT = 4242;

/**
 * Generate a 32-byte tunnel encryption key, returned as base64.
 */
export function generateTunnelKey(): string {
  return randomBytes(32).toString("base64");
}

export interface TunnelCredentials {
  virtualIp: string;
  relayHost: string;
  relayPort: number;
  tunnelKey: string;
}

/**
 * Build tunnel credentials for a user who just received a virtual IP.
 */
export function buildTunnelCredentials(virtualIp: string): TunnelCredentials {
  return {
    virtualIp,
    relayHost: RELAY_HOST,
    relayPort: RELAY_PORT,
    tunnelKey: generateTunnelKey(),
  };
}
