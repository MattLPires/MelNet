import { v4 as uuidv4 } from "uuid";
import { Room } from "../models/room";

const rooms = new Map<string, Room>();

export interface CreateRoomOptions {
  password?: string;
  maxPlayers?: number;
  gameTag?: string;
}

function generateInviteCode(): string {
  return uuidv4().replace(/-/g, "").slice(0, 8);
}

export function createRoom(
  name: string,
  hostId: string,
  options: CreateRoomOptions = {}
): Room {
  const trimmedName = name?.trim() ?? "";
  if (!trimmedName) {
    throw new Error("Room name is required");
  }

  const maxPlayers = options.maxPlayers ?? 8;
  if (maxPlayers < 2 || maxPlayers > 16) {
    throw new Error("maxPlayers must be between 2 and 16");
  }

  const room: Room = {
    id: uuidv4(),
    name: trimmedName,
    password: options.password,
    maxPlayers,
    gameTag: options.gameTag ?? "",
    hostId,
    inviteCode: generateInviteCode(),
    status: "waiting",
    members: [],
  };

  rooms.set(room.id, room);
  return room;
}

export function findByInviteCode(code: string): Room | undefined {
  for (const room of rooms.values()) {
    if (room.inviteCode === code) {
      return room;
    }
  }
  return undefined;
}

export function findById(id: string): Room | undefined {
  return rooms.get(id);
}

export function listPublicRooms(): Room[] {
  const result: Room[] = [];
  for (const room of rooms.values()) {
    if (!room.password && room.status !== "closed") {
      result.push(room);
    }
  }
  return result;
}

export function listUserRooms(userId: string): Room[] {
  const result: Room[] = [];
  for (const room of rooms.values()) {
    if (room.status !== "closed" && (room.hostId === userId || room.members.some((m) => m.userId === userId))) {
      result.push(room);
    }
  }
  return result;
}

export function deleteRoom(id: string): void {
  rooms.delete(id);
}

export function addMember(
  roomId: string,
  userId: string,
  nickname: string
): void {
  const room = rooms.get(roomId);
  if (!room) {
    throw new Error("Room not found");
  }
  if (room.members.length >= room.maxPlayers) {
    throw new Error("Room is full");
  }
  if (room.members.some((m) => m.userId === userId)) {
    throw new Error("User already in room");
  }
  room.members.push({ userId, nickname });
}

export function removeMember(roomId: string, userId: string): void {
  const room = rooms.get(roomId);
  if (!room) {
    throw new Error("Room not found");
  }
  room.members = room.members.filter((m) => m.userId !== userId);
}

/** Clear all rooms — useful for testing. */
export function clearRooms(): void {
  rooms.clear();
}
