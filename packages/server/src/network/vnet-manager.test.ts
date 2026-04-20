import { describe, it, expect, beforeEach } from "vitest";
import { VirtualNetworkManager } from "./vnet-manager";

let vnet: VirtualNetworkManager;

beforeEach(() => {
  vnet = new VirtualNetworkManager();
});

describe("createSubnet", () => {
  it("allocates a /24 subnet for a room", () => {
    const info = vnet.createSubnet("room-1");

    expect(info.roomId).toBe("room-1");
    expect(info.cidr).toMatch(/^10\.\d+\.\d+\.0\/24$/);
    expect(info.prefix).toMatch(/^10\.\d+\.\d+$/);
  });

  it("allocates different subnets for different rooms", () => {
    const a = vnet.createSubnet("room-a");
    const b = vnet.createSubnet("room-b");

    expect(a.cidr).not.toBe(b.cidr);
    expect(a.prefix).not.toBe(b.prefix);
  });

  it("throws when subnet already exists for room", () => {
    vnet.createSubnet("room-1");
    expect(() => vnet.createSubnet("room-1")).toThrow(
      "Subnet already exists for room room-1"
    );
  });
});

describe("assignIp", () => {
  it("assigns sequential IPs starting at .1", () => {
    vnet.createSubnet("room-1");

    const ip1 = vnet.assignIp("room-1", "user-1");
    const ip2 = vnet.assignIp("room-1", "user-2");

    const subnet = vnet.getSubnet("room-1")!;
    expect(ip1).toBe(`${subnet.prefix}.1`);
    expect(ip2).toBe(`${subnet.prefix}.2`);
  });

  it("throws when room has no subnet", () => {
    expect(() => vnet.assignIp("no-room", "user-1")).toThrow(
      "No subnet for room no-room"
    );
  });

  it("throws when user already has an IP", () => {
    vnet.createSubnet("room-1");
    vnet.assignIp("room-1", "user-1");

    expect(() => vnet.assignIp("room-1", "user-1")).toThrow(
      "User user-1 already has an IP in room room-1"
    );
  });

  it("throws when subnet is exhausted (254 hosts)", () => {
    vnet.createSubnet("room-1");

    // Fill all 254 usable host addresses (.1 through .254)
    for (let i = 1; i <= 254; i++) {
      vnet.assignIp("room-1", `user-${i}`);
    }

    expect(() => vnet.assignIp("room-1", "user-255")).toThrow("exhausted");
  });
});

describe("releaseIp", () => {
  it("releases an IP so it can be reused", () => {
    vnet.createSubnet("room-1");
    const ip1 = vnet.assignIp("room-1", "user-1");
    vnet.assignIp("room-1", "user-2");

    vnet.releaseIp("room-1", "user-1");

    // The released IP (.1) should be reused for the next assignment
    const ip3 = vnet.assignIp("room-1", "user-3");
    expect(ip3).toBe(ip1);
  });

  it("throws when room has no subnet", () => {
    expect(() => vnet.releaseIp("no-room", "user-1")).toThrow(
      "No subnet for room no-room"
    );
  });

  it("throws when user has no IP", () => {
    vnet.createSubnet("room-1");
    expect(() => vnet.releaseIp("room-1", "user-1")).toThrow(
      "User user-1 has no IP in room room-1"
    );
  });
});

describe("destroySubnet", () => {
  it("removes the subnet and all assignments", () => {
    vnet.createSubnet("room-1");
    vnet.assignIp("room-1", "user-1");

    vnet.destroySubnet("room-1");

    expect(vnet.getSubnet("room-1")).toBeUndefined();
    expect(vnet.getIp("room-1", "user-1")).toBeUndefined();
  });

  it("frees the octet pair for reuse", () => {
    vnet.createSubnet("room-1");
    vnet.destroySubnet("room-1");

    // Creating a new subnet should be able to reuse the freed octets
    const second = vnet.createSubnet("room-2");
    // We just verify it doesn't throw and produces a valid subnet
    expect(second.cidr).toMatch(/^10\.\d+\.\d+\.0\/24$/);
  });

  it("throws when room has no subnet", () => {
    expect(() => vnet.destroySubnet("no-room")).toThrow(
      "No subnet for room no-room"
    );
  });
});

describe("getIp", () => {
  it("returns the assigned IP for a user", () => {
    vnet.createSubnet("room-1");
    const ip = vnet.assignIp("room-1", "user-1");

    expect(vnet.getIp("room-1", "user-1")).toBe(ip);
  });

  it("returns undefined for unknown room", () => {
    expect(vnet.getIp("no-room", "user-1")).toBeUndefined();
  });

  it("returns undefined for user without assignment", () => {
    vnet.createSubnet("room-1");
    expect(vnet.getIp("room-1", "user-1")).toBeUndefined();
  });
});

describe("getSubnet", () => {
  it("returns subnet info for a room", () => {
    const created = vnet.createSubnet("room-1");
    const fetched = vnet.getSubnet("room-1");

    expect(fetched).toEqual(created);
  });

  it("returns undefined for unknown room", () => {
    expect(vnet.getSubnet("no-room")).toBeUndefined();
  });
});

describe("room isolation", () => {
  it("assigns IPs from different subnets for different rooms", () => {
    vnet.createSubnet("room-a");
    vnet.createSubnet("room-b");

    const ipA = vnet.assignIp("room-a", "user-1");
    const ipB = vnet.assignIp("room-b", "user-1");

    // Same user gets different IPs in different rooms
    expect(ipA).not.toBe(ipB);

    // IPs belong to their respective subnets
    const subnetA = vnet.getSubnet("room-a")!;
    const subnetB = vnet.getSubnet("room-b")!;
    expect(ipA.startsWith(subnetA.prefix)).toBe(true);
    expect(ipB.startsWith(subnetB.prefix)).toBe(true);
  });

  it("destroying one room does not affect another", () => {
    vnet.createSubnet("room-a");
    vnet.createSubnet("room-b");
    const ipB = vnet.assignIp("room-b", "user-1");

    vnet.destroySubnet("room-a");

    expect(vnet.getSubnet("room-b")).toBeDefined();
    expect(vnet.getIp("room-b", "user-1")).toBe(ipB);
  });
});

describe("getAssignments", () => {
  it("returns all IP assignments for a room", () => {
    vnet.createSubnet("room-1");
    vnet.assignIp("room-1", "user-1");
    vnet.assignIp("room-1", "user-2");

    const assignments = vnet.getAssignments("room-1");
    expect(assignments).toHaveLength(2);
    expect(assignments.map((a) => a.userId).sort()).toEqual(["user-1", "user-2"]);
  });

  it("returns empty array for unknown room", () => {
    expect(vnet.getAssignments("no-room")).toEqual([]);
  });
});
