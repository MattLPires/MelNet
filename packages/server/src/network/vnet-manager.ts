/**
 * VirtualNetworkManager — allocates isolated /24 subnets per room
 * and assigns unique virtual IPs to members within each subnet.
 *
 * Subnet range: 10.0.0.0/8
 * Each room gets a /24 (e.g. 10.0.1.0/24, 10.0.2.0/24, …)
 * Host IPs start at .1 within each subnet.
 *
 * Requirements: 8.2, 10.1, 10.2, 10.3
 */

export interface SubnetInfo {
  roomId: string;
  /** e.g. "10.0.1.0/24" */
  cidr: string;
  /** e.g. "10.0.1" — the first three octets */
  prefix: string;
}

export interface VirtualIpAssignment {
  userId: string;
  ip: string;
}

interface SubnetState {
  info: SubnetInfo;
  /** userId → full IP string */
  assignments: Map<string, string>;
  /** Pool of released host-part numbers available for reuse */
  released: number[];
  /** Next host-part number to allocate when released pool is empty */
  nextHost: number;
}

export class VirtualNetworkManager {
  private subnets = new Map<string, SubnetState>();
  /**
   * Tracks which second+third octet pairs are in use.
   * Key format: "second.third" e.g. "0.1"
   */
  private usedOctets = new Set<string>();
  private nextSecond = 0;
  private nextThird = 1; // start at 1 so first subnet is 10.0.1.0/24

  /**
   * Allocate a new /24 subnet for a room.
   * Returns the SubnetInfo describing the allocation.
   */
  createSubnet(roomId: string): SubnetInfo {
    if (this.subnets.has(roomId)) {
      throw new Error(`Subnet already exists for room ${roomId}`);
    }

    const octets = this.allocateOctets();
    if (!octets) {
      throw new Error("No available subnets");
    }

    const prefix = `10.${octets.second}.${octets.third}`;
    const info: SubnetInfo = {
      roomId,
      cidr: `${prefix}.0/24`,
      prefix,
    };

    this.subnets.set(roomId, {
      info,
      assignments: new Map(),
      released: [],
      nextHost: 1,
    });

    return info;
  }

  /**
   * Assign the next available virtual IP in the room's subnet to a user.
   */
  assignIp(roomId: string, userId: string): string {
    const state = this.getState(roomId);

    if (state.assignments.has(userId)) {
      throw new Error(`User ${userId} already has an IP in room ${roomId}`);
    }

    const host = this.nextHostNumber(state);
    const ip = `${state.info.prefix}.${host}`;
    state.assignments.set(userId, ip);
    return ip;
  }

  /**
   * Release a user's virtual IP back to the pool.
   */
  releaseIp(roomId: string, userId: string): void {
    const state = this.getState(roomId);

    const ip = state.assignments.get(userId);
    if (!ip) {
      throw new Error(`User ${userId} has no IP in room ${roomId}`);
    }

    const host = parseInt(ip.split(".")[3], 10);
    state.assignments.delete(userId);
    state.released.push(host);
  }

  /**
   * Destroy the subnet for a room, freeing all IPs and the octet pair.
   */
  destroySubnet(roomId: string): void {
    const state = this.subnets.get(roomId);
    if (!state) {
      throw new Error(`No subnet for room ${roomId}`);
    }

    // Free the octet pair
    const parts = state.info.prefix.split(".");
    const key = `${parts[1]}.${parts[2]}`;
    this.usedOctets.delete(key);

    this.subnets.delete(roomId);
  }

  /**
   * Get the virtual IP assigned to a user in a room.
   */
  getIp(roomId: string, userId: string): string | undefined {
    const state = this.subnets.get(roomId);
    if (!state) return undefined;
    return state.assignments.get(userId);
  }

  /**
   * Get subnet info for a room.
   */
  getSubnet(roomId: string): SubnetInfo | undefined {
    return this.subnets.get(roomId)?.info;
  }

  /**
   * Get all IP assignments for a room.
   */
  getAssignments(roomId: string): VirtualIpAssignment[] {
    const state = this.subnets.get(roomId);
    if (!state) return [];
    return Array.from(state.assignments.entries()).map(([userId, ip]) => ({
      userId,
      ip,
    }));
  }

  /** Reset all state — useful for testing. */
  clear(): void {
    this.subnets.clear();
    this.usedOctets.clear();
    this.nextSecond = 0;
    this.nextThird = 1;
  }

  // ── private helpers ──────────────────────────────────────────

  private getState(roomId: string): SubnetState {
    const state = this.subnets.get(roomId);
    if (!state) {
      throw new Error(`No subnet for room ${roomId}`);
    }
    return state;
  }

  private allocateOctets(): { second: number; third: number } | null {
    // Walk through 10.second.third.0/24 space
    const startSecond = this.nextSecond;
    const startThird = this.nextThird;

    let second = startSecond;
    let third = startThird;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const key = `${second}.${third}`;
      if (!this.usedOctets.has(key)) {
        this.usedOctets.add(key);
        // Advance cursor for next allocation
        third++;
        if (third > 255) {
          third = 0;
          second++;
        }
        if (second > 255) {
          second = 0;
        }
        this.nextSecond = second;
        this.nextThird = third;
        return { second: parseInt(key.split(".")[0]), third: parseInt(key.split(".")[1]) };
      }

      // Advance
      third++;
      if (third > 255) {
        third = 0;
        second++;
      }
      if (second > 255) {
        second = 0;
      }

      // Full loop — no space left
      if (second === startSecond && third === startThird) {
        return null;
      }
    }
  }

  private nextHostNumber(state: SubnetState): number {
    if (state.released.length > 0) {
      return state.released.shift()!;
    }

    if (state.nextHost > 254) {
      throw new Error(`Subnet ${state.info.cidr} exhausted`);
    }

    const host = state.nextHost;
    state.nextHost++;
    return host;
  }
}
