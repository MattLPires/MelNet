import {
  createRoom,
  findByInviteCode,
  findById,
  addMember,
  removeMember,
  listPublicRooms,
  listUserRooms,
  deleteRoom,
} from "../store/room-store";
import {
  vnetManager,
  buildTunnelCredentials,
} from "../network";

interface HandlerResponse {
  type: string;
  payload: Record<string, unknown>;
}

function errorResponse(code: string, message: string): HandlerResponse {
  return { type: "error", payload: { code, message } };
}

function sanitizeRoom(room: ReturnType<typeof findById>) {
  if (!room) return null;
  return {
    id: room.id,
    name: room.name,
    hasPassword: !!room.password,
    maxPlayers: room.maxPlayers,
    gameTag: room.gameTag,
    hostId: room.hostId,
    inviteCode: room.inviteCode,
    status: room.status,
    members: room.members,
  };
}

export function handleCreateRoom(
  payload: { name?: string; password?: string; maxPlayers?: number; gameTag?: string },
  userId: string,
  nickname: string,
): HandlerResponse {
  const { name, password, maxPlayers, gameTag } = payload;

  if (!name || !name.trim()) {
    return errorResponse("MISSING_FIELDS", "Room name is required");
  }

  try {
    const room = createRoom(name, userId, { password, maxPlayers, gameTag });
    addMember(room.id, userId, nickname);

    // Create isolated subnet for this room and assign IP to host
    vnetManager.createSubnet(room.id);
    const hostIp = vnetManager.assignIp(room.id, userId);
    const tunnel = buildTunnelCredentials(hostIp);

    return {
      type: "room-created",
      payload: { room: sanitizeRoom(room), inviteCode: room.inviteCode, tunnel },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create room";
    return errorResponse("CREATE_ROOM_FAILED", message);
  }
}

export function handleJoinRoom(
  payload: { inviteCode?: string; password?: string },
  userId: string,
  nickname: string,
): HandlerResponse {
  const { inviteCode, password } = payload;

  if (!inviteCode) {
    return errorResponse("MISSING_FIELDS", "Invite code is required");
  }

  const room = findByInviteCode(inviteCode);
  if (!room) {
    return errorResponse("ROOM_NOT_FOUND", "Room not found");
  }

  if (room.status === "closed") {
    return errorResponse("ROOM_CLOSED", "Room is closed");
  }

  if (room.password && room.password !== password) {
    return errorResponse("INVALID_PASSWORD", "Invalid room password");
  }

  try {
    addMember(room.id, userId, nickname);
  } catch {
    // Already a member — that's fine, continue
  }

  try {
    // Get or assign virtual IP
    let memberIp = vnetManager.getIp(room.id, userId);
    if (!memberIp) {
      memberIp = vnetManager.assignIp(room.id, userId);
    }
    const tunnel = buildTunnelCredentials(memberIp);

    return {
      type: "room-joined",
      payload: { room: sanitizeRoom(room), tunnel },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to join room";
    return errorResponse("JOIN_ROOM_FAILED", message);
  }
}

export function handleLeaveRoom(
  payload: { roomId?: string },
  userId: string,
): HandlerResponse {
  const { roomId } = payload;

  if (!roomId) {
    return errorResponse("MISSING_FIELDS", "Room ID is required");
  }

  const room = findById(roomId);
  if (!room) {
    return errorResponse("ROOM_NOT_FOUND", "Room not found");
  }

  const isMember = room.members.some((m) => m.userId === userId);
  if (!isMember) {
    return errorResponse("NOT_IN_ROOM", "You are not in this room");
  }

  try {
    removeMember(roomId, userId);

    // Release virtual IP for the leaving member
    try {
      vnetManager.releaseIp(roomId, userId);
    } catch {
      // IP may not exist if subnet was already destroyed — ignore
    }

    return {
      type: "room-left",
      payload: { roomId },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to leave room";
    return errorResponse("LEAVE_ROOM_FAILED", message);
  }
}

export function handleKickMember(
  payload: { roomId?: string; userId?: string },
  hostUserId: string,
): HandlerResponse {
  const { roomId, userId: targetUserId } = payload;

  if (!roomId || !targetUserId) {
    return errorResponse("MISSING_FIELDS", "Room ID and user ID are required");
  }

  const room = findById(roomId);
  if (!room) {
    return errorResponse("ROOM_NOT_FOUND", "Room not found");
  }

  if (room.hostId !== hostUserId) {
    return errorResponse("NOT_HOST", "Only the host can kick members");
  }

  if (targetUserId === hostUserId) {
    return errorResponse("CANNOT_KICK_SELF", "Host cannot kick themselves");
  }

  const isMember = room.members.some((m) => m.userId === targetUserId);
  if (!isMember) {
    return errorResponse("NOT_IN_ROOM", "Target user is not in this room");
  }

  try {
    removeMember(roomId, targetUserId);

    // Release virtual IP for the kicked member
    try {
      vnetManager.releaseIp(roomId, targetUserId);
    } catch {
      // IP may not exist if subnet was already destroyed — ignore
    }

    return {
      type: "member-kicked",
      payload: { roomId, kickedUserId: targetUserId },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to kick member";
    return errorResponse("KICK_FAILED", message);
  }
}

export function handleListRooms(): HandlerResponse {
  const rooms = listPublicRooms();
  return {
    type: "room-list",
    payload: { rooms: rooms.map(sanitizeRoom) },
  };
}

export function handleMyRooms(userId: string): HandlerResponse {
  const rooms = listUserRooms(userId);
  return {
    type: "my-rooms",
    payload: { rooms: rooms.map(sanitizeRoom) },
  };
}

export function handleCloseRoom(
  payload: { roomId?: string },
  userId: string,
): HandlerResponse {
  const { roomId } = payload;

  if (!roomId) {
    return errorResponse("MISSING_FIELDS", "Room ID is required");
  }

  const room = findById(roomId);
  if (!room) {
    return errorResponse("ROOM_NOT_FOUND", "Room not found");
  }

  if (room.hostId !== userId) {
    return errorResponse("NOT_HOST", "Only the host can close the room");
  }

  try {
    // Destroy the virtual subnet and free all IPs
    try {
      vnetManager.destroySubnet(roomId);
    } catch {
      // Subnet may not exist — ignore
    }

    deleteRoom(roomId);

    return {
      type: "room-closed",
      payload: { roomId },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to close room";
    return errorResponse("CLOSE_ROOM_FAILED", message);
  }
}
