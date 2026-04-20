import { WebSocketServer, WebSocket } from "ws";
import {
  handleRegister,
  handleLogin,
  handleGuestLogin,
} from "./handlers/auth";
import {
  handleCreateRoom,
  handleJoinRoom,
  handleLeaveRoom,
  handleKickMember,
  handleListRooms,
  handleMyRooms,
  handleCloseRoom,
} from "./handlers/room";
import { findById } from "./store/room-store";
import { verifyToken, JwtPayload } from "./utils/jwt";
import { loginRateLimiter, roomJoinRateLimiter, chatRateLimiter } from "./utils/rate-limiter";
import { sanitizePayload } from "./utils/ip-sanitizer";

const PORT = Number(process.env.PORT) || 3001;

const wss = new WebSocketServer({ port: PORT });

/** Authenticated user info stored per socket connection. */
export interface SocketUser {
  userId: string;
  nickname: string;
}

/** Map of socket → authenticated user. */
const socketUsers = new Map<WebSocket, SocketUser>();

export function getSocketUsers(): Map<WebSocket, SocketUser> {
  return socketUsers;
}

function send(socket: WebSocket, data: { type: string; payload: unknown }) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(sanitizePayload(data)));
  }
}

/**
 * Broadcast a message to all connected members of a room, optionally excluding one socket.
 */
function broadcastToRoom(
  roomId: string,
  data: { type: string; payload: unknown },
  excludeSocket?: WebSocket,
) {
  const room = findById(roomId);
  if (!room) return;

  const memberIds = new Set(room.members.map((m) => m.userId));

  for (const [sock, user] of socketUsers) {
    if (sock === excludeSocket) continue;
    if (memberIds.has(user.userId)) {
      send(sock, data);
    }
  }
}

/**
 * Authenticate a socket from a JWT token in the payload.
 * Stores the user info on the socketUsers map.
 */
function authenticateSocket(
  socket: WebSocket,
  payload: Record<string, unknown>,
): SocketUser | null {
  const token = payload.token as string | undefined;
  if (!token) {
    send(socket, {
      type: "error",
      payload: { code: "AUTH_REQUIRED", message: "Authentication required. Send a token." },
    });
    return null;
  }

  try {
    const decoded: JwtPayload = verifyToken(token);
    const user: SocketUser = { userId: decoded.userId, nickname: decoded.nickname };
    socketUsers.set(socket, user);
    return user;
  } catch {
    send(socket, {
      type: "error",
      payload: { code: "INVALID_TOKEN", message: "Invalid or expired token" },
    });
    return null;
  }
}

/**
 * Get the authenticated user for a socket, or try to authenticate from payload.
 */
function getOrAuthUser(
  socket: WebSocket,
  payload: Record<string, unknown>,
): SocketUser | null {
  const existing = socketUsers.get(socket);
  if (existing) return existing;
  return authenticateSocket(socket, payload);
}

async function routeMessage(
  socket: WebSocket,
  message: { type: string; payload?: Record<string, unknown> },
  clientIp: string,
) {
  const payload = (message.payload ?? {}) as Record<string, unknown>;

  switch (message.type) {
    // ── Auth handlers ──
    case "auth-restore": {
      const user = authenticateSocket(socket, payload);
      if (user) {
        send(socket, { type: "auth-restored", payload: { userId: user.userId, nickname: user.nickname } });
      }
      break;
    }
    case "register": {
      const result = await handleRegister(payload as Parameters<typeof handleRegister>[0]);
      if (result.type === "register-success") {
        const u = result.payload.user as { id: string; nickname: string };
        socketUsers.set(socket, { userId: u.id, nickname: u.nickname });
      }
      send(socket, result);
      break;
    }
    case "login": {
      const rateCheck = loginRateLimiter.check(clientIp);
      if (!rateCheck.allowed) {
        const retrySeconds = Math.ceil((rateCheck.retryAfterMs ?? 0) / 1000);
        send(socket, {
          type: "error",
          payload: {
            code: "RATE_LIMITED",
            message: `Too many login attempts. Try again in ${retrySeconds} seconds.`,
            retryAfterMs: rateCheck.retryAfterMs,
          },
        });
        break;
      }
      const loginResult = await handleLogin(payload as Parameters<typeof handleLogin>[0]);
      if (loginResult.type === "login-success") {
        const u = loginResult.payload.user as { id: string; nickname: string };
        socketUsers.set(socket, { userId: u.id, nickname: u.nickname });
      }
      send(socket, loginResult);
      break;
    }
    case "guest-login": {
      const guestResult = handleGuestLogin(payload as Parameters<typeof handleGuestLogin>[0]);
      if (guestResult.type === "guest-login-success") {
        const u = guestResult.payload.user as { id: string; nickname: string };
        socketUsers.set(socket, { userId: u.id, nickname: u.nickname });
      }
      send(socket, guestResult);
      break;
    }

    // ── Room handlers (require authentication) ──
    case "create-room": {
      const user = getOrAuthUser(socket, payload);
      if (!user) break;
      const result = handleCreateRoom(
        payload as Parameters<typeof handleCreateRoom>[0],
        user.userId,
        user.nickname,
      );
      send(socket, result);
      break;
    }
    case "join-room": {
      const rateCheck = roomJoinRateLimiter.check(clientIp);
      if (!rateCheck.allowed) {
        const retrySeconds = Math.ceil((rateCheck.retryAfterMs ?? 0) / 1000);
        send(socket, {
          type: "error",
          payload: {
            code: "RATE_LIMITED",
            message: `Too many room join attempts. Try again in ${retrySeconds} seconds.`,
            retryAfterMs: rateCheck.retryAfterMs,
          },
        });
        break;
      }
      const user = getOrAuthUser(socket, payload);
      if (!user) break;
      const result = handleJoinRoom(
        payload as Parameters<typeof handleJoinRoom>[0],
        user.userId,
        user.nickname,
      );
      send(socket, result);
      // Broadcast member-joined to other room members
      if (result.type === "room-joined") {
        const room = result.payload.room as { id: string } | null;
        if (room) {
          broadcastToRoom(
            room.id,
            {
              type: "member-joined",
              payload: { roomId: room.id, userId: user.userId, nickname: user.nickname },
            },
            socket,
          );
        }
      }
      break;
    }
    case "leave-room": {
      const user = getOrAuthUser(socket, payload);
      if (!user) break;
      const result = handleLeaveRoom(
        payload as Parameters<typeof handleLeaveRoom>[0],
        user.userId,
      );
      // Broadcast member-left BEFORE sending response (so room still has context)
      if (result.type === "room-left") {
        const roomId = result.payload.roomId as string;
        broadcastToRoom(
          roomId,
          { type: "member-left", payload: { roomId, userId: user.userId } },
          socket,
        );
      }
      send(socket, result);
      break;
    }
    case "kick-member": {
      const user = getOrAuthUser(socket, payload);
      if (!user) break;
      const result = handleKickMember(
        payload as Parameters<typeof handleKickMember>[0],
        user.userId,
      );
      send(socket, result);
      // Notify kicked member and broadcast to room
      if (result.type === "member-kicked") {
        const roomId = result.payload.roomId as string;
        const kickedUserId = result.payload.kickedUserId as string;
        // Send kick notification to the kicked user's socket
        for (const [sock, u] of socketUsers) {
          if (u.userId === kickedUserId) {
            send(sock, {
              type: "member-kicked",
              payload: { roomId, userId: kickedUserId },
            });
          }
        }
        // Broadcast to remaining room members
        broadcastToRoom(
          roomId,
          { type: "member-kicked", payload: { roomId, userId: kickedUserId } },
          socket,
        );
      }
      break;
    }
    case "close-room": {
      const user = getOrAuthUser(socket, payload);
      if (!user) break;
      const result = handleCloseRoom(
        payload as Parameters<typeof handleCloseRoom>[0],
        user.userId,
      );
      send(socket, result);
      // Broadcast room-closed to all members
      if (result.type === "room-closed") {
        const roomId = result.payload.roomId as string;
        broadcastToRoom(roomId, { type: "room-closed", payload: { roomId } }, socket);
      }
      break;
    }
    case "chat-message": {
      const user = getOrAuthUser(socket, payload);
      if (!user) break;
      const rateCheck = chatRateLimiter.check(user.userId);
      if (!rateCheck.allowed) {
        const retrySeconds = Math.ceil((rateCheck.retryAfterMs ?? 0) / 1000);
        send(socket, {
          type: "error",
          payload: {
            code: "RATE_LIMITED",
            message: `Too many messages. Try again in ${retrySeconds} seconds.`,
            retryAfterMs: rateCheck.retryAfterMs,
          },
        });
        break;
      }
      const roomId = payload.roomId as string | undefined;
      const messageText = payload.message as string | undefined;
      if (!roomId || !messageText) {
        send(socket, {
          type: "error",
          payload: { code: "INVALID_PAYLOAD", message: "roomId and message are required" },
        });
        break;
      }
      const room = findById(roomId);
      if (!room || !room.members.some((m) => m.userId === user.userId)) {
        send(socket, {
          type: "error",
          payload: { code: "NOT_IN_ROOM", message: "You are not a member of this room" },
        });
        break;
      }
      const chatPayload = {
        roomId,
        userId: user.userId,
        nickname: user.nickname,
        message: messageText,
        timestamp: new Date().toISOString(),
      };
      broadcastToRoom(roomId, { type: "chat-message", payload: chatPayload });
      break;
    }
    case "list-rooms": {
      send(socket, handleListRooms());
      break;
    }
    case "my-rooms": {
      const user = getOrAuthUser(socket, payload);
      if (!user) break;
      send(socket, handleMyRooms(user.userId));
      break;
    }

    default:
      send(socket, {
        type: "error",
        payload: { code: "UNKNOWN_TYPE", message: `Unknown message type: ${message.type}` },
      });
  }
}

wss.on("listening", () => {
  console.log(`[MelNet] WebSocket relay server listening on port ${PORT}`);
});

wss.on("connection", (socket, req) => {
  const clientIp = req.socket.remoteAddress ?? "unknown";
  console.log(`[MelNet] Client connected`);

  socket.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log(`[MelNet] Received: ${message.type ?? "unknown"}`);
      routeMessage(socket, message, clientIp);
    } catch {
      send(socket, { type: "error", payload: { code: "INVALID_JSON", message: "Invalid JSON" } });
    }
  });

  socket.on("close", () => {
    socketUsers.delete(socket);
    console.log(`[MelNet] Client disconnected`);
  });

  send(socket, { type: "welcome", payload: { message: "Connected to MelNet relay" } });
});

export { wss };
