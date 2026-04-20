import { describe, it, expect, beforeEach } from "vitest";
import {
  createRoom,
  findByInviteCode,
  findById,
  listPublicRooms,
  deleteRoom,
  addMember,
  removeMember,
  clearRooms,
} from "./room-store";

beforeEach(() => {
  clearRooms();
});

describe("createRoom", () => {
  it("creates a room with defaults and generates invite code", () => {
    const room = createRoom("My Room", "host-1");

    expect(room.id).toBeDefined();
    expect(room.name).toBe("My Room");
    expect(room.hostId).toBe("host-1");
    expect(room.maxPlayers).toBe(8);
    expect(room.gameTag).toBe("");
    expect(room.password).toBeUndefined();
    expect(room.status).toBe("waiting");
    expect(room.members).toEqual([]);
    expect(room.inviteCode).toHaveLength(8);
  });

  it("creates a room with custom options", () => {
    const room = createRoom("CS Room", "host-2", {
      password: "secret",
      maxPlayers: 10,
      gameTag: "cs",
    });

    expect(room.password).toBe("secret");
    expect(room.maxPlayers).toBe(10);
    expect(room.gameTag).toBe("cs");
  });

  it("throws when name is empty", () => {
    expect(() => createRoom("", "host-1")).toThrow("Room name is required");
  });

  it("throws when name is only whitespace", () => {
    expect(() => createRoom("   ", "host-1")).toThrow("Room name is required");
  });

  it("throws when maxPlayers is below 2", () => {
    expect(() => createRoom("Room", "host-1", { maxPlayers: 1 })).toThrow(
      "maxPlayers must be between 2 and 16"
    );
  });

  it("throws when maxPlayers is above 16", () => {
    expect(() => createRoom("Room", "host-1", { maxPlayers: 17 })).toThrow(
      "maxPlayers must be between 2 and 16"
    );
  });

  it("accepts boundary values for maxPlayers (2 and 16)", () => {
    const room2 = createRoom("Room2", "h", { maxPlayers: 2 });
    const room16 = createRoom("Room16", "h", { maxPlayers: 16 });
    expect(room2.maxPlayers).toBe(2);
    expect(room16.maxPlayers).toBe(16);
  });
});

describe("findByInviteCode", () => {
  it("finds a room by its invite code", () => {
    const room = createRoom("Test", "host-1");
    const found = findByInviteCode(room.inviteCode);
    expect(found?.id).toBe(room.id);
  });

  it("returns undefined for unknown code", () => {
    expect(findByInviteCode("nope1234")).toBeUndefined();
  });
});

describe("findById", () => {
  it("finds a room by id", () => {
    const room = createRoom("Test", "host-1");
    expect(findById(room.id)?.name).toBe("Test");
  });

  it("returns undefined for unknown id", () => {
    expect(findById("unknown")).toBeUndefined();
  });
});

describe("listPublicRooms", () => {
  it("returns rooms without a password", () => {
    createRoom("Public", "h1");
    createRoom("Private", "h2", { password: "pw" });

    const publicRooms = listPublicRooms();
    expect(publicRooms).toHaveLength(1);
    expect(publicRooms[0].name).toBe("Public");
  });

  it("excludes closed rooms", () => {
    const room = createRoom("Closing", "h1");
    room.status = "closed";

    expect(listPublicRooms()).toHaveLength(0);
  });
});

describe("deleteRoom", () => {
  it("removes a room from the store", () => {
    const room = createRoom("ToDelete", "h1");
    deleteRoom(room.id);
    expect(findById(room.id)).toBeUndefined();
  });
});

describe("addMember / removeMember", () => {
  it("adds a member to a room", () => {
    const room = createRoom("Room", "h1");
    addMember(room.id, "user-1", "Player1");

    const updated = findById(room.id)!;
    expect(updated.members).toHaveLength(1);
    expect(updated.members[0]).toEqual({ userId: "user-1", nickname: "Player1" });
  });

  it("throws when room is full", () => {
    const room = createRoom("Small", "h1", { maxPlayers: 2 });
    addMember(room.id, "u1", "P1");
    addMember(room.id, "u2", "P2");

    expect(() => addMember(room.id, "u3", "P3")).toThrow("Room is full");
  });

  it("throws when user is already in room", () => {
    const room = createRoom("Room", "h1");
    addMember(room.id, "u1", "P1");

    expect(() => addMember(room.id, "u1", "P1")).toThrow("User already in room");
  });

  it("throws when room does not exist (add)", () => {
    expect(() => addMember("fake", "u1", "P1")).toThrow("Room not found");
  });

  it("removes a member from a room", () => {
    const room = createRoom("Room", "h1");
    addMember(room.id, "u1", "P1");
    removeMember(room.id, "u1");

    expect(findById(room.id)!.members).toHaveLength(0);
  });

  it("throws when room does not exist (remove)", () => {
    expect(() => removeMember("fake", "u1")).toThrow("Room not found");
  });
});
