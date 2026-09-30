import type { Server as HttpServer } from "node:http";
import { randomUUID } from "node:crypto";
import { Server, type Socket } from "socket.io";
import { verifyAccessToken } from "./jwt";
import { sessionCookieNames } from "./tabSession";
import * as watchPartyService from "../services/watchParty.service";

type Ack = (response: { ok: boolean; message?: string }) => void;
type RoomUser = { id: number; username: string; name: string | null };
type RoomStatusKind = "JOINED" | "LEFT" | "HOST_TRANSFERRED" | "HOST_ASSIGNED";
type PartySocket = Socket & {
  data: {
    userId: number;
    partyId?: number;
    partyCode?: string;
  };
};

const presence = new Map<number, Map<number, Set<string>>>();
const departureTimers = new Map<string, NodeJS.Timeout>();
const partyLocks = new Map<number, Promise<void>>();
const LEAVE_GRACE_MS = Number(process.env.WATCH_PARTY_LEAVE_GRACE_MS || 10_000);
let notificationServer: Server | null = null;

export function notifyUserOfInvitation(userId: number) {
  notificationServer?.to(`user:${userId}`).emit("invitation:changed");
}

function parseCookie(header: string | undefined, name: string) {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) {
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
  }
  return undefined;
}

function roomName(partyId: number) {
  return `watch-party:${partyId}`;
}

function departureKey(partyId: number, userId: number) {
  return `${partyId}:${userId}`;
}

function withPartyLock(partyId: number, work: () => Promise<void>) {
  const previous = partyLocks.get(partyId) || Promise.resolve();
  const current = previous.catch(() => undefined).then(work);
  partyLocks.set(partyId, current);
  void current.finally(() => {
    if (partyLocks.get(partyId) === current) partyLocks.delete(partyId);
  }).catch(() => undefined);
  return current;
}

function addPresence(partyId: number, userId: number, socketId: string) {
  let users = presence.get(partyId);
  if (!users) {
    users = new Map();
    presence.set(partyId, users);
  }
  let sockets = users.get(userId);
  if (!sockets) {
    sockets = new Set();
    users.set(userId, sockets);
  }
  sockets.add(socketId);
}

function removePresence(partyId: number, userId: number, socketId: string) {
  const users = presence.get(partyId);
  const sockets = users?.get(userId);
  sockets?.delete(socketId);
  if (sockets?.size === 0) users?.delete(userId);
  if (users?.size === 0) presence.delete(partyId);
  return !users?.has(userId);
}

function onlineUserIds(partyId: number) {
  return [...(presence.get(partyId)?.keys() || [])];
}

function safeAck(ack: Ack | undefined, response: Parameters<Ack>[0]) {
  if (typeof ack === "function") ack(response);
}

function errorMessage(error: unknown) {
  return error instanceof watchPartyService.WatchPartyError
    ? error.message
    : "Watch party request failed";
}

export function createSocketServer(httpServer: HttpServer, allowedOrigins: string[]) {
  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true
    }
  });
  notificationServer = io;

  io.use((rawSocket, next) => {
    try {
      const cookies = sessionCookieNames(rawSocket.handshake.auth?.tabSessionId);
      const token = parseCookie(rawSocket.handshake.headers.cookie, cookies.access);
      if (!token) return next(new Error("Authentication required"));
      const payload = verifyAccessToken(token);
      rawSocket.data.userId = payload.userId;
      next();
    } catch {
      next(new Error("Invalid or expired access token"));
    }
  });

  async function emitPresence(partyId: number) {
    const members = await watchPartyService.getOnlineMembers(partyId, onlineUserIds(partyId));
    io.to(roomName(partyId)).emit("presence:updated", { members });
    return members;
  }

  function emitRoomStatus(partyId: number, kind: RoomStatusKind, user: RoomUser, target?: RoomUser) {
    io.to(roomName(partyId)).emit("room:status", {
      id: randomUUID(),
      kind,
      user,
      target,
      createdAt: new Date().toISOString()
    });
  }

  async function finalizeDeparture(partyId: number, userId: number) {
    await withPartyLock(partyId, async () => {
      if (presence.get(partyId)?.has(userId)) return;
      const [departingUser] = await watchPartyService.getOnlineMembers(partyId, [userId]);
      if (!departingUser) return;
      const result = await watchPartyService.leaveParty(partyId, userId, onlineUserIds(partyId));
      if (!result) return;
      if (result.ended) {
        io.to(roomName(partyId)).emit("party:ended", { reason: "No members remain online" });
        return;
      }
      emitRoomStatus(partyId, "LEFT", departingUser);
      if (result.newHostUserId) {
        io.to(roomName(partyId)).emit("host:changed", {
          hostUserId: result.newHostUserId,
          reason: "HOST_LEFT"
        });
        const [newHost] = await watchPartyService.getOnlineMembers(partyId, [result.newHostUserId]);
        if (newHost) emitRoomStatus(partyId, "HOST_ASSIGNED", newHost);
      }
      await emitPresence(partyId);
    });
  }

  io.on("connection", (rawSocket) => {
    const socket = rawSocket as PartySocket;
    void socket.join(`user:${socket.data.userId}`);

    socket.on("party:join", async (payload: { code?: unknown }, ack?: Ack) => {
      try {
        const code = String(payload?.code || "").trim().toUpperCase();
        const party = await watchPartyService.joinParty(code, socket.data.userId);

        if (socket.data.partyId && socket.data.partyId !== party.id) {
          const oldPartyId = socket.data.partyId;
          const wasLastSocket = removePresence(oldPartyId, socket.data.userId, socket.id);
          socket.data.partyId = undefined;
          socket.data.partyCode = undefined;
          await socket.leave(roomName(oldPartyId));
          if (wasLastSocket) await finalizeDeparture(oldPartyId, socket.data.userId);
        }

        const wasOnline = presence.get(party.id)?.has(socket.data.userId) ?? false;
        const timerKey = departureKey(party.id, socket.data.userId);
        const timer = departureTimers.get(timerKey);
        if (timer) clearTimeout(timer);
        departureTimers.delete(timerKey);

        socket.data.partyId = party.id;
        socket.data.partyCode = party.code;
        addPresence(party.id, socket.data.userId, socket.id);
        await socket.join(roomName(party.id));

        const snapshot = await watchPartyService.getPartySnapshot(
          party.code,
          socket.data.userId,
          onlineUserIds(party.id)
        );
        socket.emit("party:snapshot", snapshot);
        const members = await emitPresence(party.id);
        if (!wasOnline && !timer) {
          const joinedUser = members.find((member) => member.id === socket.data.userId);
          if (joinedUser) emitRoomStatus(party.id, "JOINED", joinedUser);
        }
        safeAck(ack, { ok: true });
      } catch (error) {
        safeAck(ack, { ok: false, message: errorMessage(error) });
      }
    });

    socket.on("playback:command", async (
      payload: { action?: unknown; position?: unknown },
      ack?: Ack
    ) => {
      try {
        const partyId = socket.data.partyId;
        if (!partyId) throw new watchPartyService.WatchPartyError("Join the party first", 400);
        const action = String(payload?.action || "");
        if (!watchPartyService.isPlaybackAction(action)) {
          throw new watchPartyService.WatchPartyError("Invalid playback action", 400);
        }
        await withPartyLock(partyId, async () => {
          const update = await watchPartyService.updatePlayback(
            partyId,
            socket.data.userId,
            action,
            Number(payload?.position)
          );
          io.to(roomName(partyId)).emit("playback:updated", update);
        });
        safeAck(ack, { ok: true });
      } catch (error) {
        safeAck(ack, { ok: false, message: errorMessage(error) });
      }
    });

    socket.on("chat:send", async (payload: { content?: unknown }, ack?: Ack) => {
      try {
        const partyId = socket.data.partyId;
        if (!partyId) throw new watchPartyService.WatchPartyError("Join the party first", 400);
        const message = await watchPartyService.createMessage(
          partyId,
          socket.data.userId,
          String(payload?.content || "")
        );
        io.to(roomName(partyId)).emit("chat:message", message);
        safeAck(ack, { ok: true });
      } catch (error) {
        safeAck(ack, { ok: false, message: errorMessage(error) });
      }
    });

    socket.on("host:transfer", async (payload: { userId?: unknown }, ack?: Ack) => {
      try {
        const partyId = socket.data.partyId;
        if (!partyId) throw new watchPartyService.WatchPartyError("Join the party first", 400);
        const targetUserId = Number(payload?.userId);
        if (!onlineUserIds(partyId).includes(targetUserId)) {
          throw new watchPartyService.WatchPartyError("The selected member is not online", 400);
        }
        await withPartyLock(partyId, async () => {
          await watchPartyService.transferHost(partyId, socket.data.userId, targetUserId);
          const users = await watchPartyService.getOnlineMembers(partyId, [socket.data.userId, targetUserId]);
          io.to(roomName(partyId)).emit("host:changed", {
            hostUserId: targetUserId,
            reason: "TRANSFERRED"
          });
          const previousHost = users.find((user) => user.id === socket.data.userId);
          const newHost = users.find((user) => user.id === targetUserId);
          if (previousHost && newHost) emitRoomStatus(partyId, "HOST_TRANSFERRED", previousHost, newHost);
          await emitPresence(partyId);
        });
        safeAck(ack, { ok: true });
      } catch (error) {
        safeAck(ack, { ok: false, message: errorMessage(error) });
      }
    });

    socket.on("party:leave", async (_payload: unknown, ack?: Ack) => {
      const partyId = socket.data.partyId;
      if (!partyId) return safeAck(ack, { ok: true });
      const userId = socket.data.userId;
      removePresence(partyId, userId, socket.id);
      socket.data.partyId = undefined;
      socket.data.partyCode = undefined;
      await socket.leave(roomName(partyId));
      try {
        await finalizeDeparture(partyId, userId);
        safeAck(ack, { ok: true });
      } catch (error) {
        safeAck(ack, { ok: false, message: errorMessage(error) });
      }
    });

    socket.on("disconnect", () => {
      const partyId = socket.data.partyId;
      if (!partyId) return;
      const userId = socket.data.userId;
      const isLastSocket = removePresence(partyId, userId, socket.id);
      if (!isLastSocket) return;

      void emitPresence(partyId).catch((error) => console.error("Could not update watch party presence", error));
      const key = departureKey(partyId, userId);
      const oldTimer = departureTimers.get(key);
      if (oldTimer) clearTimeout(oldTimer);
      const timer = setTimeout(() => {
        departureTimers.delete(key);
        void finalizeDeparture(partyId, userId).catch((error) => console.error("Could not finalize watch party departure", error));
      }, LEAVE_GRACE_MS);
      departureTimers.set(key, timer);
    });
  });

  return io;
}
