/**
 * Integration layer between ApplicationFirewall and TunnelClient.
 *
 * Wraps TunnelClient so that all outgoing and incoming packets are
 * filtered through the ApplicationFirewall before being sent/delivered.
 * Blocked packets are dropped and forwarded as moderation events.
 *
 * Validates: Requirements 9.1, 9.2, 9.3, 7.2
 */

import { TunnelClient, PacketHandler } from '../tunnel/TunnelClient';
import { ApplicationFirewall, FirewallEvent, Protocol } from './ApplicationFirewall';

export interface ModerationEvent {
  type: FirewallEvent['type'];
  reason: string;
  srcIp: string;
  dstIp: string;
  dstPort: number;
  protocol: Protocol;
  timestamp: number;
  direction: 'outgoing' | 'incoming';
}

export interface FirewalledTunnelOptions {
  onModerationEvent: (event: ModerationEvent) => void;
}

/**
 * Wraps a TunnelClient with an ApplicationFirewall so that every packet
 * is checked before entering or leaving the tunnel.
 */
export class FirewalledTunnel {
  private readonly tunnel: TunnelClient;
  private readonly firewall: ApplicationFirewall;
  private readonly onModerationEvent: (event: ModerationEvent) => void;
  private userPacketHandler: PacketHandler | null = null;

  constructor(
    tunnelClient: TunnelClient,
    firewall: ApplicationFirewall,
    options: FirewalledTunnelOptions
  ) {
    this.tunnel = tunnelClient;
    this.firewall = firewall;
    this.onModerationEvent = options.onModerationEvent;

    // Intercept incoming packets from the tunnel
    this.tunnel.onPacket((srcIp, data) => {
      this.handleIncoming(srcIp, data);
    });
  }

  /**
   * Send a packet through the tunnel after firewall filtering.
   * Blocked packets are silently dropped and a moderation event is emitted.
   */
  sendPacket(
    dstIp: string,
    dstPort: number,
    protocol: Protocol,
    data: Buffer
  ): boolean {
    const result = this.firewall.filterOutgoing(data, dstIp, dstPort, protocol);

    if (!result.allowed) {
      this.onModerationEvent({
        type: 'block',
        reason: result.reason ?? 'Blocked by firewall',
        srcIp: this.tunnel.virtualIp,
        dstIp,
        dstPort,
        protocol,
        timestamp: Date.now(),
        direction: 'outgoing',
      });
      return false;
    }

    this.tunnel.sendPacket(dstIp, data);
    return true;
  }

  /**
   * Register a handler for incoming packets that pass firewall filtering.
   */
  onPacket(callback: PacketHandler): void {
    this.userPacketHandler = callback;
  }

  /**
   * Handle an incoming packet from the tunnel — filter before delivering.
   * Uses port 0 and 'udp' as defaults since raw tunnel packets don't carry
   * explicit port/protocol metadata (the relay strips that layer).
   */
  private handleIncoming(srcIp: string, data: Buffer): void {
    // Tunnel-level incoming packets arrive as raw payloads.
    // We filter with port=0 and protocol='udp' as the tunnel is UDP-based.
    const result = this.firewall.filterIncoming(data, srcIp, 0, 'udp');

    if (!result.allowed) {
      this.onModerationEvent({
        type: 'block',
        reason: result.reason ?? 'Blocked by firewall',
        srcIp,
        dstIp: this.tunnel.virtualIp,
        dstPort: 0,
        protocol: 'udp',
        timestamp: Date.now(),
        direction: 'incoming',
      });
      return;
    }

    if (this.userPacketHandler) {
      this.userPacketHandler(srcIp, data);
    }
  }
}
