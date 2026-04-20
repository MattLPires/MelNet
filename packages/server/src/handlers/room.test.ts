import { describe, it, expect, beforeEach } from "vitest";
import {
  handleCreateRoom,
  handleJoinRoom,
  handleLeaveRoom,
  handleKickMember,
  handleListRooms,
  handleCloseRoom,
} from "./room";
import { clearRooms, findById } from "../store/room-store";
import { vnetManager } from "../network";

beforeEach(() => {
  clearRooms();
  vnetManager.clear();
});

describe("handleCreateRoom", () => {
  it("creates a room and returns invite code", () => {
    const result = handleCreateRoom({ name: "My Room" }, "user-1", "Player1");

    expect(result.type).toBe("room-created");
    const payload = result.payload as { room: Record<string, unknown>; inviteCode: string };
    expect(payload.inviteCode).toBeDefined();
    expect(payload.room.name).toBe("My Room");
    expect(payload.room.hostId).toBe("user-1");
    expect(payload.room.members).toEqual([{ userId: "user-1", nickname: "Player1" }]);
  });

  it("returns error when name is missing", () => {
    const result = handleCreateRoom({ name: "" }, "user-1", "Player1");
    expect(result.type).toBe("error");
    expect((result.payload as { code: string }).code).toBe("MISSING_FIELDS");
  });

  it("creates room with password and custom settings", () => {
    const result = handleCreateRoom(
      { name: "Private", password: "secret", maxPlayers: 4, gameTag: "minecraft" },
      "user-1",
      "Player1",
    );

    expect(result.type).toBe("room-created");
    const room = (result.payload as { room: Record<string, unknown> }).room;
    expect(room.hasPassword).toBe(true);
    expect(room.maxPlayers).toBe(4);
    expect(room.gameTag).toBe("minecraft");
  });

  it("returns error for invalid maxPlayers", () => {
    const result = handleCreateRoom({ name: "Room", maxPlayers: 20 }, "user-1", "Player1");
    expect(result.type).toBe("error");
    expect((result.payload as { code: string }).code).toBe("CREATE_ROOM_FAILED");
  });
});

describe("handleJoinRoom", () => {
  function createTestRoom(password?: string) {
    const result = handleCreateRoom(
      { name: "Test Room", password },
      "host-1",
      "Host",
    );
    const payload = result.payload as { inviteCode: string; room: { id: string } };
    return { inviteCode: payload.inviteCode, roomId: payload.room.id };
  }

  it("joins a room by invite code", () => {
    const { inviteCode } = createTestRoom();
    const result = handleJoinRoom({ inviteCode }, "user-2", "Player2");

    expect(result.type).toBe("room-joined");
    const room = (result.payload as { room: Record<string, unknown> }).room;
    expect((room.members as Array<{ userId: string }>).length).toBe(2);
  });

  it("returns error for missing invite code", () => {
    const result = handleJoinRoom({}, "user-2", "Player2");
    expect(result.type).toBe("error");
    expect((result.payload as { code: string }).code).toBe("MISSING_FIELDS");
  });

  it("returns error for invalid invite code", () => {
    const result = handleJoinRoom({ inviteCode: "bad-code" }, "user-2", "Player2");
    expect(result.type).toBe("error");
    expect((result.payload as { code: string }).code).toBe("ROOM_NOT_FOUND");
  });

  it("requires password for private rooms", () => {
    const { inviteCode } = createTestRoom("secret");
    const result = handleJoinRoom({ inviteCode }, "user-2", "Player2");

    expect(result.type).toBe("error");
    expect((result.payload as { code: string }).code).toBe("INVALID_PASSWORD");
  });

  it("joins private room with correct password", () => {
    const { inviteCode } = createTestRoom("secret");
    const result = handleJoinRoom({ inviteCode, password: "secret" }, "user-2", "Player2");

    expect(result.type).toBe("room-joined");
  });

  it("returns error when room is full", () => {
    const createResult = handleCreateRoom(
      { name: "Small Room", maxPlayers: 2 },
      "host-1",
      "Host",
    );
    const { inviteCode } = createResult.payload as { inviteCode: string };

    handleJoinRoom({ inviteCode }, "user-2", "Player2");
    const result = handleJoinRoom({ inviteCode }, "user-3", "Player3");

    expect(result.type).toBe("error");
    expect((result.payload as { code: string }).code).toBe("JOIN_ROOM_FAILED");
  });
});

describe("handleLeaveRoom", () => {
  function createAndJoin() {
    const result = handleCreateRoom({ name: "Room" }, "host-1", "Host");
    const { room } = result.payload as { room: { id: string } };
    handleJoinRoom(
      { inviteCode: (result.payload as { inviteCode: string }).inviteCode },
      "user-2",
      "Player2",
    );
    return room.id;
  }

  it("leaves a room successfully", () => {
    const roomId = createAndJoin();
    const result = handleLeaveRoom({ roomId }, "user-2");

    expect(result.type).toBe("room-left");
    expect(result.payload.roomId).toBe(roomId);

    const room = findById(roomId)!;
    expect(room.members.length).toBe(1);
    expect(room.members[0].userId).toBe("host-1");
  });

  it("returns error for missing roomId", () => {
    const result = handleLeaveRoom({}, "user-2");
    expect(result.type).toBe("error");
    expect((result.payload as { code: string }).code).toBe("MISSING_FIELDS");
  });

  it("returns error when not in room", () => {
    const createResult = handleCreateRoom({ name: "Room" }, "host-1", "Host");
    const roomId = (createResult.payload as { room: { id: string } }).room.id;
    const result = handleLeaveRoom({ roomId }, "stranger");

    expect(result.type).toBe("error");
    expect((result.payload as { code: string }).code).toBe("NOT_IN_ROOM");
  });
});

describe("handleKickMember", () => {
  function createAndJoin() {
    const result = handleCreateRoom({ name: "Room" }, "host-1", "Host");
    const payload = result.payload as { room: { id: string }; inviteCode: string };
    handleJoinRoom({ inviteCode: payload.inviteCode }, "user-2", "Player2");
    return payload.room.id;
  }

  it("host kicks a member successfully", () => {
    const roomId = createAndJoin();
    const result = handleKickMember({ roomId, userId: "user-2" }, "host-1");

    expect(result.type).toBe("member-kicked");
    expect(result.payload.kickedUserId).toBe("user-2");

    const room = findById(roomId)!;
    expect(room.members.length).toBe(1);
  });

  it("returns error when non-host tries to kick", () => {
    const roomId = createAndJoin();
    const result = handleKickMember({ roomId, userId: "host-1" }, "user-2");

    expect(result.type).toBe("error");
    expect((result.payload as { code: string }).code).toBe("NOT_HOST");
  });

  it("returns error when host tries to kick themselves", () => {
    const roomId = createAndJoin();
    const result = handleKickMember({ roomId, userId: "host-1" }, "host-1");

    expect(result.type).toBe("error");
    expect((result.payload as { code: string }).code).toBe("CANNOT_KICK_SELF");
  });

  it("returns error for missing fields", () => {
    const result = handleKickMember({}, "host-1");
    expect(result.type).toBe("error");
    expect((result.payload as { code: string }).code).toBe("MISSING_FIELDS");
  });

  it("returns error when target is not in room", () => {
    const result = handleCreateRoom({ name: "Room" }, "host-1", "Host");
    const roomId = (result.payload as { room: { id: string } }).room.id;
    const kickResult = handleKickMember({ roomId, userId: "stranger" }, "host-1");

    expect(kickResult.type).toBe("error");
    expect((kickResult.payload as { code: string }).code).toBe("NOT_IN_ROOM");
  });
});

describe("handleListRooms", () => {
  it("returns empty list when no rooms exist", () => {
    const result = handleListRooms();
    expect(result.type).toBe("room-list");
    expect((result.payload as { rooms: unknown[] }).rooms).toEqual([]);
  });

  it("returns only public rooms", () => {
    handleCreateRoom({ name: "Public Room" }, "user-1", "Player1");
    handleCreateRoom({ name: "Private Room", password: "secret" }, "user-2", "Player2");

    const result = handleListRooms();
    const rooms = (result.payload as { rooms: Array<{ name: string }> }).rooms;
    expect(rooms.length).toBe(1);
    expect(rooms[0].name).toBe("Public Room");
  });

  it("does not expose password in room list", () => {
    handleCreateRoom({ name: "Public Room" }, "user-1", "Player1");

    const result = handleListRooms();
    const rooms = (result.payload as { rooms: Array<Record<string, unknown>> }).rooms;
    expect(rooms[0]).not.toHaveProperty("password");
    expect(rooms[0]).toHaveProperty("hasPassword");
  });
});


// ── WebSocket ↔ VNet integration tests (Task 9.4) ──────────────────

describe("room ↔ vnet integration", () => {
  function createTestRoom() {
    const result = handleCreateRoom({ name: "VNet Room" }, "host-1", "Host");
    const payload = result.payload as {
      room: { id: string };
      inviteCode: string;
      tunnel: { virtualIp: string; relayHost: string; relayPort: number; tunnelKey: string };
    };
    return { result, payload };
  }

  it("creates subnet and assigns host IP on room creation", () => {
    const { result, payload } = createTestRoom();

    expect(result.type).toBe("room-created");
    expect(payload.tunnel).toBeDefined();
    expect(payload.tunnel.virtualIp).toMatch(/^10\.\d+\.\d+\.\d+$/);
    expect(payload.tunnel.relayHost).toBe("localhost");
    expect(payload.tunnel.relayPort).toBe(4242);
    expect(payload.tunnel.tunnelKey).toBeDefined();
    // tunnelKey should be 32 bytes base64 encoded
    expect(Buffer.from(payload.tunnel.tunnelKey, "base64").length).toBe(32);

    // Subnet should exist
    const subnet = vnetManager.getSubnet(payload.room.id);
    expect(subnet).toBeDefined();
    expect(subnet!.cidr).toMatch(/^10\.\d+\.\d+\.0\/24$/);
  });

  it("assigns IP and returns tunnel credentials on join", () => {
    const { payload: createPayload } = createTestRoom();
    const joinResult = handleJoinRoom(
      { inviteCode: createPayload.inviteCode },
      "user-2",
      "Player2",
    );

    expect(joinResult.type).toBe("room-joined");
    const joinPayload = joinResult.payload as {
      tunnel: { virtualIp: string; relayHost: string; relayPort: number; tunnelKey: string };
    };
    expect(joinPayload.tunnel).toBeDefined();
    expect(joinPayload.tunnel.virtualIp).toMatch(/^10\.\d+\.\d+\.\d+$/);
    // Host and member should have different IPs
    expect(joinPayload.tunnel.virtualIp).not.toBe(createPayload.tunnel.virtualIp);
    // But same subnet prefix
    const hostPrefix = createPayload.tunnel.virtualIp.split(".").slice(0, 3).join(".");
    const memberPrefix = joinPayload.tunnel.virtualIp.split(".").slice(0, 3).join(".");
    expect(memberPrefix).toBe(hostPrefix);
  });

  it("releases IP on leave", () => {
    const { payload: createPayload } = createTestRoom();
    handleJoinRoom({ inviteCode: createPayload.inviteCode }, "user-2", "Player2");

    const ip = vnetManager.getIp(createPayload.room.id, "user-2");
    expect(ip).toBeDefined();

    handleLeaveRoom({ roomId: createPayload.room.id }, "user-2");

    const ipAfter = vnetManager.getIp(createPayload.room.id, "user-2");
    expect(ipAfter).toBeUndefined();
  });

  it("releases IP on kick", () => {
    const { payload: createPayload } = createTestRoom();
    handleJoinRoom({ inviteCode: createPayload.inviteCode }, "user-2", "Player2");

    handleKickMember({ roomId: createPayload.room.id, userId: "user-2" }, "host-1");

    const ipAfter = vnetManager.getIp(createPayload.room.id, "user-2");
    expect(ipAfter).toBeUndefined();
  });

  it("destroys subnet on room close", () => {
    const { payload: createPayload } = createTestRoom();

    const closeResult = handleCloseRoom({ roomId: createPayload.room.id }, "host-1");
    expect(closeResult.type).toBe("room-closed");

    const subnet = vnetManager.getSubnet(createPayload.room.id);
    expect(subnet).toBeUndefined();
  });

  it("only host can close room", () => {
    const { payload: createPayload } = createTestRoom();
    handleJoinRoom({ inviteCode: createPayload.inviteCode }, "user-2", "Player2");

    const result = handleCloseRoom({ roomId: createPayload.room.id }, "user-2");
    expect(result.type).toBe("error");
    expect((result.payload as { code: string }).code).toBe("NOT_HOST");
  });

  it("close-room returns error for missing roomId", () => {
    const result = handleCloseRoom({}, "host-1");
    expect(result.type).toBe("error");
    expect((result.payload as { code: string }).code).toBe("MISSING_FIELDS");
  });
});
