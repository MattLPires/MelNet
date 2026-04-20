/**
 * Application-level packet firewall for MelNet virtual network.
 *
 * Filters traffic to allow only whitelisted game ports/protocols,
 * blocks remote access protocols (RDP, VNC, SSH), ICMP pings,
 * and detects port scanning attempts.
 *
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4, 12.1, 12.2
 */

export type Protocol = 'tcp' | 'udp' | 'icmp';

export interface FirewallEvent {
  type: 'block' | 'scan_detected';
  reason: string;
  srcIp: string;
  dstIp: string;
  dstPort: number;
  protocol: Protocol;
  timestamp: number;
}

export interface FilterResult {
  allowed: boolean;
  reason?: string;
}

export interface FirewallOptions {
  onBlock: (event: FirewallEvent) => void;
  /** Port scan detection: max unique ports before triggering (default 5) */
  scanThreshold?: number;
  /** Port scan detection: time window in ms (default 10000) */
  scanWindowMs?: number;
}

/**
 * Well-known LAN game ports allowed through the firewall.
 * Both TCP and UDP are allowed on these ports.
 */
export const GAME_PORT_WHITELIST: ReadonlySet<number> = new Set([
  // Minecraft
  25565,
  // Source Engine / CS / CS2 / TF2 / Garry's Mod
  27015, 27016, 27017, 27018, 27019, 27020,
  // Terraria
  7777,
  // Age of Empires II DE
  53400,
  // Factorio
  34197,
  // Stardew Valley
  24642,
  // Among Us
  22023,
  // Don't Starve Together
  10999, 11000,
  // Valheim
  2456, 2457, 2458,
  // Satisfactory
  7777, 15000, 15777,
  // Unturned
  27015, 27016,
  // Risk of Rain 2
  27015,
  // Left 4 Dead 2
  27015,
]);

/** Ports that are always blocked (remote access protocols). */
const BLOCKED_PORTS: ReadonlyMap<number, string> = new Map([
  [3389, 'RDP'],
  [5900, 'VNC'],
  [5901, 'VNC'],
  [5902, 'VNC'],
  [22, 'SSH'],
]);

const DEFAULT_SCAN_THRESHOLD = 5;
const DEFAULT_SCAN_WINDOW_MS = 10_000;

/** Tracks port access history per source IP for scan detection. */
interface PortAccessRecord {
  ports: Set<number>;
  timestamps: number[];
}

export class ApplicationFirewall {
  private readonly onBlock: (event: FirewallEvent) => void;
  private readonly scanThreshold: number;
  private readonly scanWindowMs: number;

  /** Tracks unique ports accessed per source IP within the scan window. */
  private portAccessMap: Map<string, PortAccessRecord> = new Map();

  /** IPs that have been flagged as scanners and are blocked. */
  private blockedScanners: Set<string> = new Set();

  constructor(options: FirewallOptions) {
    this.onBlock = options.onBlock;
    this.scanThreshold = options.scanThreshold ?? DEFAULT_SCAN_THRESHOLD;
    this.scanWindowMs = options.scanWindowMs ?? DEFAULT_SCAN_WINDOW_MS;
  }

  /**
   * Filter an outgoing packet before it enters the tunnel.
   * For outgoing traffic, scan detection tracks by local client identity ('local').
   */
  filterOutgoing(
    _packet: Buffer,
    dstIp: string,
    dstPort: number,
    protocol: Protocol
  ): FilterResult {
    return this.applyRules('local', dstIp, dstPort, protocol);
  }

  /**
   * Filter an incoming packet received from the tunnel.
   * For incoming traffic, scan detection tracks by the remote source IP.
   */
  filterIncoming(
    _packet: Buffer,
    srcIp: string,
    srcPort: number,
    protocol: Protocol
  ): FilterResult {
    return this.applyRules(srcIp, srcIp, srcPort, protocol);
  }

  /**
   * Reset internal state (scan tracking, blocked scanners).
   * Useful for testing or when leaving a room.
   */
  reset(): void {
    this.portAccessMap.clear();
    this.blockedScanners.clear();
  }

  /**
   * Core rule engine applied to both incoming and outgoing traffic.
   */
  private applyRules(
    sourceIp: string,
    targetIp: string,
    port: number,
    protocol: Protocol
  ): FilterResult {
    const now = Date.now();

    // Rule 1: Block all ICMP (ping) — Req 9.4
    if (protocol === 'icmp') {
      const reason = 'ICMP (ping) blocked';
      this.emitBlock(reason, sourceIp, targetIp, port, protocol, now);
      return { allowed: false, reason };
    }

    // Rule 2: Block remote access protocols — Req 12.2
    const blockedService = BLOCKED_PORTS.get(port);
    if (blockedService) {
      const reason = `${blockedService} (port ${port}) blocked — remote access not allowed`;
      this.emitBlock(reason, sourceIp, targetIp, port, protocol, now);
      return { allowed: false, reason };
    }

    // Rule 3: Check if source is already flagged as scanner — Req 9.2
    if (this.blockedScanners.has(sourceIp)) {
      const reason = `Source ${sourceIp} blocked — port scanning detected`;
      this.emitBlock(reason, sourceIp, targetIp, port, protocol, now);
      return { allowed: false, reason };
    }

    // Rule 4: Port scan detection — Req 9.2
    if (this.detectPortScan(sourceIp, port, now)) {
      const reason = `Port scanning detected from ${sourceIp}`;
      this.blockedScanners.add(sourceIp);
      this.emitBlock(reason, sourceIp, targetIp, port, protocol, now, 'scan_detected');
      return { allowed: false, reason };
    }

    // Rule 5: Only allow whitelisted game ports — Req 9.1, 9.3, 12.1
    if (!GAME_PORT_WHITELIST.has(port)) {
      const reason = `Port ${port} not in game whitelist`;
      this.emitBlock(reason, sourceIp, targetIp, port, protocol, now);
      return { allowed: false, reason };
    }

    // Allowed
    return { allowed: true };
  }

  /**
   * Track port access and detect scanning behavior.
   * Returns true if a scan is detected (threshold exceeded within window).
   */
  private detectPortScan(sourceIp: string, port: number, now: number): boolean {
    let record = this.portAccessMap.get(sourceIp);
    if (!record) {
      record = { ports: new Set(), timestamps: [] };
      this.portAccessMap.set(sourceIp, record);
    }

    // Prune entries outside the time window
    const cutoff = now - this.scanWindowMs;
    record.timestamps = record.timestamps.filter((t) => t >= cutoff);

    // If all timestamps were pruned, reset the port set too
    if (record.timestamps.length === 0) {
      record.ports.clear();
    }

    // Add current access
    record.ports.add(port);
    record.timestamps.push(now);

    // Threshold exceeded → scan detected
    return record.ports.size > this.scanThreshold;
  }

  private emitBlock(
    reason: string,
    srcIp: string,
    dstIp: string,
    dstPort: number,
    protocol: Protocol,
    timestamp: number,
    type: FirewallEvent['type'] = 'block'
  ): void {
    this.onBlock({
      type,
      reason,
      srcIp,
      dstIp,
      dstPort,
      protocol,
      timestamp,
    });
  }
}
