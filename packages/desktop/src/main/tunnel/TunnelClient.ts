import { createSocket, Socket } from 'node:dgram';
import { encrypt, decrypt } from './crypto';

/** Packet format: [4 bytes dst virtual IP][encrypted payload] */
const IP_HEADER_LENGTH = 4;

export type PacketHandler = (srcVirtualIp: string, data: Buffer) => void;

/**
 * Parse a dotted-quad IP string (e.g. "10.0.1.2") into a 4-byte Buffer.
 */
export function ipToBuffer(ip: string): Buffer {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    throw new Error(`Invalid IP address: ${ip}`);
  }
  return Buffer.from(parts);
}

/**
 * Convert a 4-byte Buffer back to a dotted-quad IP string.
 */
export function bufferToIp(buf: Buffer): string {
  if (buf.length < 4) {
    throw new Error('Buffer too short for IP address');
  }
  return `${buf[0]}.${buf[1]}.${buf[2]}.${buf[3]}`;
}

/**
 * Client-side encrypted tunnel that communicates with the UDP relay.
 *
 * Packet wire format (sent to relay):
 *   [4 bytes destination virtual IP][encrypted payload]
 *
 * The encrypted payload uses ChaCha20-Poly1305 (see crypto.ts).
 *
 * NOTE: Actual TUN/TAP interface creation requires native bindings (N-API).
 * This module provides the TypeScript transport and crypto layer.
 * The native TUN/TAP binding would be integrated here via a platform-specific
 * addon that captures/injects packets on the virtual network interface.
 */
export class TunnelClient {
  private socket: Socket | null = null;
  private packetHandler: PacketHandler | null = null;
  private _connected = false;
  private _relayHost = '';
  private _relayPort = 0;
  private _virtualIp = '';
  private _peerKey: Buffer = Buffer.alloc(0);

  get isConnected(): boolean {
    return this._connected;
  }

  get virtualIp(): string {
    return this._virtualIp;
  }

  /**
   * Establish an encrypted tunnel connection to the UDP relay.
   *
   * @param relayHost - Hostname or IP of the relay server
   * @param relayPort - UDP port of the relay server
   * @param virtualIp - This client's assigned virtual IP (e.g. "10.0.1.2")
   * @param peerKey - 32-byte symmetric key for ChaCha20-Poly1305 encryption
   */
  connect(relayHost: string, relayPort: number, virtualIp: string, peerKey: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this._connected) {
        resolve();
        return;
      }

      try {
        this._relayHost = relayHost;
        this._relayPort = relayPort;
        this._virtualIp = virtualIp;
        this._peerKey = peerKey;

        this.socket = createSocket('udp4');

        this.socket.on('message', (msg: Buffer) => {
          this.handleIncoming(msg);
        });

        this.socket.on('error', (err: Error) => {
          if (!this._connected) {
            reject(err);
          }
        });

        // Bind to any available port, then mark as connected
        this.socket.bind(0, () => {
          this._connected = true;

          // TODO: Native TUN/TAP interface setup would go here.
          // In production, this is where we'd create a virtual network
          // interface (e.g. via wireguard-go or a custom N-API addon)
          // and configure OS routing to direct game traffic through it.

          resolve();
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Tear down the tunnel and release resources.
   */
  disconnect(): void {
    if (this.socket) {
      try {
        this.socket.close();
      } catch {
        // Socket may already be closed
      }
      this.socket = null;
    }
    this._connected = false;
    this._relayHost = '';
    this._relayPort = 0;
    this._virtualIp = '';
    this._peerKey = Buffer.alloc(0);
    this.packetHandler = null;

    // TODO: Tear down native TUN/TAP interface here
  }

  /**
   * Encrypt and send a packet to a destination virtual IP via the relay.
   *
   * Wire format: [4 bytes dst IP][encrypted payload]
   */
  sendPacket(dstVirtualIp: string, data: Buffer): void {
    if (!this._connected || !this.socket) {
      throw new Error('Tunnel is not connected');
    }

    const dstIpBuf = ipToBuffer(dstVirtualIp);
    const encrypted = encrypt(data, this._peerKey);
    const packet = Buffer.concat([dstIpBuf, encrypted]);

    this.socket.send(packet, this._relayPort, this._relayHost);
  }

  /**
   * Register a handler for incoming decrypted packets.
   */
  onPacket(callback: PacketHandler): void {
    this.packetHandler = callback;
  }

  /**
   * Handle an incoming UDP message from the relay.
   * Expected format: [4 bytes src virtual IP][encrypted payload]
   */
  private handleIncoming(msg: Buffer): void {
    if (msg.length < IP_HEADER_LENGTH) {
      return; // Malformed packet, ignore
    }

    try {
      const srcIp = bufferToIp(msg.subarray(0, IP_HEADER_LENGTH));
      const encryptedPayload = msg.subarray(IP_HEADER_LENGTH);
      const decrypted = decrypt(encryptedPayload, this._peerKey);

      if (this.packetHandler) {
        this.packetHandler(srcIp, decrypted);
      }
    } catch {
      // Decryption failed or malformed packet — silently drop
    }
  }
}
