// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { ApplicationFirewall, FirewallEvent } from './ApplicationFirewall';

describe('ApplicationFirewall', () => {
  let firewall: ApplicationFirewall;
  let blockedEvents: FirewallEvent[];
  const onBlock = (event: FirewallEvent) => blockedEvents.push(event);
  const dummyPacket = Buffer.from('test-payload');

  beforeEach(() => {
    blockedEvents = [];
    firewall = new ApplicationFirewall({ onBlock });
  });

  // ─── ICMP blocking (Req 9.4) ──────────────────────────────────

  describe('ICMP blocking', () => {
    it('blocks outgoing ICMP (ping)', () => {
      const result = firewall.filterOutgoing(dummyPacket, '10.0.1.2', 0, 'icmp');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('ICMP');
      expect(blockedEvents).toHaveLength(1);
    });

    it('blocks incoming ICMP (ping)', () => {
      const result = firewall.filterIncoming(dummyPacket, '10.0.1.3', 0, 'icmp');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('ICMP');
    });
  });

  // ─── Remote access protocol blocking (Req 12.2) ───────────────

  describe('remote access protocol blocking', () => {
    it('blocks RDP (port 3389)', () => {
      const result = firewall.filterOutgoing(dummyPacket, '10.0.1.2', 3389, 'tcp');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('RDP');
    });

    it('blocks VNC (port 5900)', () => {
      const result = firewall.filterOutgoing(dummyPacket, '10.0.1.2', 5900, 'tcp');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('VNC');
    });

    it('blocks SSH (port 22)', () => {
      const result = firewall.filterOutgoing(dummyPacket, '10.0.1.2', 22, 'tcp');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('SSH');
    });

    it('blocks remote access on UDP too', () => {
      const result = firewall.filterOutgoing(dummyPacket, '10.0.1.2', 3389, 'udp');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('RDP');
    });

    it('emits block event for remote access attempts', () => {
      firewall.filterIncoming(dummyPacket, '10.0.1.5', 22, 'tcp');
      expect(blockedEvents).toHaveLength(1);
      expect(blockedEvents[0].type).toBe('block');
      expect(blockedEvents[0].protocol).toBe('tcp');
    });
  });

  // ─── Game port whitelist (Req 9.1, 9.3, 12.1) ────────────────

  describe('game port whitelist', () => {
    it('allows traffic to Minecraft port (25565)', () => {
      const result = firewall.filterOutgoing(dummyPacket, '10.0.1.2', 25565, 'tcp');
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('allows traffic to Source Engine port (27015)', () => {
      const result = firewall.filterOutgoing(dummyPacket, '10.0.1.2', 27015, 'udp');
      expect(result.allowed).toBe(true);
    });

    it('allows traffic to Terraria port (7777)', () => {
      const result = firewall.filterOutgoing(dummyPacket, '10.0.1.2', 7777, 'tcp');
      expect(result.allowed).toBe(true);
    });

    it('blocks traffic to non-game port (80 HTTP)', () => {
      const result = firewall.filterOutgoing(dummyPacket, '10.0.1.2', 80, 'tcp');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not in game whitelist');
    });

    it('blocks traffic to non-game port (443 HTTPS)', () => {
      const result = firewall.filterOutgoing(dummyPacket, '10.0.1.2', 443, 'tcp');
      expect(result.allowed).toBe(false);
    });

    it('blocks traffic to arbitrary high port not in whitelist', () => {
      const result = firewall.filterOutgoing(dummyPacket, '10.0.1.2', 9999, 'udp');
      expect(result.allowed).toBe(false);
    });

    it('allows incoming traffic on whitelisted game ports', () => {
      const result = firewall.filterIncoming(dummyPacket, '10.0.1.3', 25565, 'tcp');
      expect(result.allowed).toBe(true);
    });

    it('blocks incoming traffic on non-whitelisted ports', () => {
      const result = firewall.filterIncoming(dummyPacket, '10.0.1.3', 8080, 'tcp');
      expect(result.allowed).toBe(false);
    });
  });

  // ─── Port scan detection (Req 9.2) ────────────────────────────

  describe('port scan detection', () => {
    it('allows up to threshold unique ports without triggering scan detection', () => {
      // Default threshold is 5 unique ports
      const ports = [80, 81, 82, 83, 84];
      for (const port of ports) {
        // These are non-whitelisted ports, so they'll be blocked by whitelist rule,
        // but scan detection should NOT trigger yet
        firewall.filterOutgoing(dummyPacket, '10.0.1.2', port, 'tcp');
      }
      // All blocked by whitelist, none by scan detection
      const scanEvents = blockedEvents.filter((e) => e.type === 'scan_detected');
      expect(scanEvents).toHaveLength(0);
    });

    it('detects port scanning when threshold is exceeded', () => {
      const fw = new ApplicationFirewall({
        onBlock,
        scanThreshold: 3,
        scanWindowMs: 10_000,
      });

      // Access 4 unique ports (exceeds threshold of 3)
      fw.filterOutgoing(dummyPacket, '10.0.1.2', 80, 'tcp');
      fw.filterOutgoing(dummyPacket, '10.0.1.2', 81, 'tcp');
      fw.filterOutgoing(dummyPacket, '10.0.1.2', 82, 'tcp');
      const result = fw.filterOutgoing(dummyPacket, '10.0.1.2', 83, 'tcp');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Port scanning detected');

      const scanEvents = blockedEvents.filter((e) => e.type === 'scan_detected');
      expect(scanEvents).toHaveLength(1);
    });

    it('blocks all subsequent traffic from a flagged scanner', () => {
      const fw = new ApplicationFirewall({
        onBlock,
        scanThreshold: 2,
        scanWindowMs: 10_000,
      });

      // Trigger scan detection (3 unique ports > threshold of 2)
      fw.filterOutgoing(dummyPacket, '10.0.1.2', 80, 'tcp');
      fw.filterOutgoing(dummyPacket, '10.0.1.2', 81, 'tcp');
      fw.filterOutgoing(dummyPacket, '10.0.1.2', 82, 'tcp');

      // Now even whitelisted game ports should be blocked from this IP
      const result = fw.filterOutgoing(dummyPacket, '10.0.1.2', 25565, 'tcp');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('port scanning detected');
    });

    it('does not flag different source IPs for each other\'s scans', () => {
      const fw = new ApplicationFirewall({
        onBlock,
        scanThreshold: 3,
        scanWindowMs: 10_000,
      });

      // IP A sends incoming traffic on 3 ports (at threshold, not over)
      fw.filterIncoming(dummyPacket, '10.0.1.2', 80, 'tcp');
      fw.filterIncoming(dummyPacket, '10.0.1.2', 81, 'tcp');
      fw.filterIncoming(dummyPacket, '10.0.1.2', 82, 'tcp');

      // IP B sends incoming traffic on 2 different ports — well under threshold
      fw.filterIncoming(dummyPacket, '10.0.1.3', 90, 'tcp');
      fw.filterIncoming(dummyPacket, '10.0.1.3', 91, 'tcp');

      // IP B should still be able to send on whitelisted ports (3rd unique port, at threshold)
      const result = fw.filterIncoming(dummyPacket, '10.0.1.3', 25565, 'tcp');
      expect(result.allowed).toBe(true);
    });

    it('same port accessed multiple times does not count as scan', () => {
      const fw = new ApplicationFirewall({
        onBlock,
        scanThreshold: 2,
        scanWindowMs: 10_000,
      });

      // Same port 10 times — only 1 unique port
      for (let i = 0; i < 10; i++) {
        fw.filterOutgoing(dummyPacket, '10.0.1.2', 80, 'tcp');
      }

      const scanEvents = blockedEvents.filter((e) => e.type === 'scan_detected');
      expect(scanEvents).toHaveLength(0);
    });
  });

  // ─── Block event emission ─────────────────────────────────────

  describe('block event emission', () => {
    it('emits event with correct fields on block', () => {
      firewall.filterOutgoing(dummyPacket, '10.0.1.2', 3389, 'tcp');

      expect(blockedEvents).toHaveLength(1);
      const event = blockedEvents[0];
      expect(event.type).toBe('block');
      expect(event.dstPort).toBe(3389);
      expect(event.protocol).toBe('tcp');
      expect(event.reason).toContain('RDP');
      expect(event.timestamp).toBeGreaterThan(0);
    });

    it('does not emit events for allowed traffic', () => {
      firewall.filterOutgoing(dummyPacket, '10.0.1.2', 25565, 'tcp');
      expect(blockedEvents).toHaveLength(0);
    });
  });

  // ─── Reset ─────────────────────────────────────────────────────

  describe('reset', () => {
    it('clears scan tracking state', () => {
      const fw = new ApplicationFirewall({
        onBlock,
        scanThreshold: 2,
        scanWindowMs: 10_000,
      });

      // Almost trigger scan
      fw.filterOutgoing(dummyPacket, '10.0.1.2', 80, 'tcp');
      fw.filterOutgoing(dummyPacket, '10.0.1.2', 81, 'tcp');

      fw.reset();

      // After reset, accessing 2 more ports should not trigger scan
      fw.filterOutgoing(dummyPacket, '10.0.1.2', 90, 'tcp');
      fw.filterOutgoing(dummyPacket, '10.0.1.2', 91, 'tcp');

      const scanEvents = blockedEvents.filter((e) => e.type === 'scan_detected');
      expect(scanEvents).toHaveLength(0);
    });

    it('clears blocked scanner list', () => {
      const fw = new ApplicationFirewall({
        onBlock,
        scanThreshold: 2,
        scanWindowMs: 10_000,
      });

      // Trigger scan block
      fw.filterOutgoing(dummyPacket, '10.0.1.2', 80, 'tcp');
      fw.filterOutgoing(dummyPacket, '10.0.1.2', 81, 'tcp');
      fw.filterOutgoing(dummyPacket, '10.0.1.2', 82, 'tcp');

      fw.reset();

      // After reset, whitelisted port should be allowed again
      const result = fw.filterOutgoing(dummyPacket, '10.0.1.2', 25565, 'tcp');
      expect(result.allowed).toBe(true);
    });
  });
});
