import { customAlphabet } from "nanoid";
import { prisma } from "../lib/prisma";

const makeRoomCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);
const publicUserSelect = {
  id: true,
  username: true,
  name: true
} as const;

export type PlaybackAction = "PLAY" | "PAUSE" | "SEEK" | "SYNC";

export class WatchPartyError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

export function isPlaybackAction(value: string): value is PlaybackAction {
  return value === "PLAY" || value === "PAUSE" || value === "SEEK" || value === "SYNC";
}

function normalizeCode(code: string) {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z2-9]{6}$/.test(normalized)) {
    throw new WatchPartyError("Invalid room code", 400);
  }
  return normalized;
}

function currentPosition(party: {
  playbackState: "PLAYING" | "PAUSED";
  playbackPosition: number;
  playbackUpdatedAt: Date;
  movie: { duration: number | null };
}, now = new Date()) {
  const elapsed = party.playbackState === "PLAYING"
    ? Math.max(0, (now.getTime() - party.playbackUpdatedAt.getTime()) / 1000)
    : 0;
  const position = Math.max(0, party.playbackPosition + elapsed);
  return party.movie.duration == null ? position : Math.min(position, party.movie.duration);
}

function playbackDto(party: {
  playbackState: "PLAYING" | "PAUSED";
  playbackPosition: number;
  playbackUpdatedAt: Date;
  version: number;
  movie: { duration: number | null };
}, now = new Date()) {
  return {
    state: party.playbackState,
    position: currentPosition(party, now),
    version: party.version,
    serverTime: now.getTime()
  };
}

export async function createParty(hostUserId: number, movieId: number) {
  if (!Number.isInteger(movieId) || movieId <= 0) {
    throw new WatchPartyError("A valid movie is required", 400);
  }
  const movie = await prisma.movie.findUnique({
    where: { id: movieId },
    select: { id: true, videoUrl: true }
  });
  if (!movie) throw new WatchPartyError("Movie not found", 404);
  if (!movie.videoUrl.trim()) {
    throw new WatchPartyError("This movie does not have a video URL configured", 400);
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = makeRoomCode();
    const existing = await prisma.watchParty.findUnique({ where: { code }, select: { id: true } });
    if (existing) continue;
    return prisma.watchParty.create({
      data: {
        code,
        hostUserId,
        movieId,
        members: {
          create: { userId: hostUserId, role: "HOST" }
        }
      },
      include: {
        movie: { select: { id: true, title: true, thumbnail: true, duration: true } }
      }
    });
  }
  throw new WatchPartyError("Could not allocate a room code", 503);
}

export async function getPartyPreview(code: string) {
  const party = await prisma.watchParty.findUnique({
    where: { code: normalizeCode(code) },
    include: {
      movie: { select: { id: true, title: true, thumbnail: true, videoUrl: true, duration: true } },
      host: { select: publicUserSelect }
    }
  });
  if (!party) throw new WatchPartyError("Watch party not found", 404);
  if (party.status !== "ACTIVE") throw new WatchPartyError("This watch party has ended", 410);
  if (!party.movie.videoUrl.trim()) {
    throw new WatchPartyError("This movie does not have a video URL configured", 400);
  }
  if (party.expiresAt && party.expiresAt <= new Date()) {
    throw new WatchPartyError("This watch party has expired", 410);
  }
  return {
    code: party.code,
    host: party.host,
    movie: party.movie,
    status: party.status
  };
}

export async function joinParty(code: string, userId: number) {
  const normalized = normalizeCode(code);
  const party = await prisma.watchParty.findUnique({
    where: { code: normalized },
    select: { id: true, code: true, status: true, expiresAt: true, hostUserId: true }
  });
  if (!party) throw new WatchPartyError("Watch party not found", 404);
  if (party.status !== "ACTIVE") throw new WatchPartyError("This watch party has ended", 410);
  if (party.expiresAt && party.expiresAt <= new Date()) {
    throw new WatchPartyError("This watch party has expired", 410);
  }

  await prisma.watchPartyMember.upsert({
    where: { partyId_userId: { partyId: party.id, userId } },
    create: {
      partyId: party.id,
      userId,
      role: userId === party.hostUserId ? "HOST" : "MEMBER"
    },
    update: {
      leftAt: null,
      lastSeenAt: new Date(),
      role: userId === party.hostUserId ? "HOST" : "MEMBER"
    }
  });
  return party;
}

export async function getOnlineMembers(partyId: number, userIds: number[]) {
  if (userIds.length === 0) return [];
  const party = await prisma.watchParty.findUnique({
    where: { id: partyId },
    select: { hostUserId: true }
  });
  if (!party) return [];
  const members = await prisma.watchPartyMember.findMany({
    where: { partyId, userId: { in: userIds }, leftAt: null },
    orderBy: { joinedAt: "asc" },
    select: {
      userId: true,
      joinedAt: true,
      user: { select: publicUserSelect }
    }
  });
  return members.map((member) => ({
    ...member.user,
    role: member.userId === party.hostUserId ? "HOST" as const : "MEMBER" as const,
    joinedAt: member.joinedAt
  }));
}

export async function getPartySnapshot(code: string, userId: number, onlineIds: number[]) {
  const now = new Date();
  const party = await prisma.watchParty.findUnique({
    where: { code: normalizeCode(code) },
    include: {
      movie: {
        select: { id: true, title: true, thumbnail: true, videoUrl: true, duration: true }
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { user: { select: publicUserSelect } }
      }
    }
  });
  if (!party) throw new WatchPartyError("Watch party not found", 404);
  if (party.status !== "ACTIVE") throw new WatchPartyError("This watch party has ended", 410);
  if (!party.movie.videoUrl.trim()) {
    throw new WatchPartyError("This movie does not have a video URL configured", 400);
  }
  const member = await prisma.watchPartyMember.findUnique({
    where: { partyId_userId: { partyId: party.id, userId } },
    select: { id: true }
  });
  if (!member) throw new WatchPartyError("Join the party first", 403);

  return {
    code: party.code,
    currentUserId: userId,
    hostUserId: party.hostUserId,
    movie: party.movie,
    playback: playbackDto(party, now),
    members: await getOnlineMembers(party.id, onlineIds),
    messages: party.messages.reverse().map((message) => ({
      id: message.id,
      content: message.content,
      createdAt: message.createdAt,
      user: message.user
    }))
  };
}

export async function updatePlayback(
  partyId: number,
  userId: number,
  action: PlaybackAction,
  requestedPosition: number
) {
  if (!Number.isFinite(requestedPosition) || requestedPosition < 0) {
    throw new WatchPartyError("Invalid playback position", 400);
  }
  const party = await prisma.watchParty.findUnique({
    where: { id: partyId },
    include: { movie: { select: { duration: true } } }
  });
  if (!party || party.status !== "ACTIVE") throw new WatchPartyError("Watch party is not active", 410);
  if (party.hostUserId !== userId) throw new WatchPartyError("Wait for the host to start the movie", 403);

  const position = party.movie.duration == null
    ? requestedPosition
    : Math.min(requestedPosition, party.movie.duration);
  const nextState = action === "PLAY"
    ? "PLAYING"
    : action === "PAUSE" ? "PAUSED" : party.playbackState;
  const now = new Date();
  const updated = await prisma.watchParty.update({
    where: { id: partyId },
    data: {
      playbackState: nextState,
      playbackPosition: position,
      playbackUpdatedAt: now,
      version: { increment: 1 }
    },
    include: { movie: { select: { duration: true } } }
  });
  return playbackDto(updated, now);
}

export async function createMessage(partyId: number, userId: number, rawContent: string) {
  const content = rawContent.trim();
  if (!content) throw new WatchPartyError("Message cannot be empty", 400);
  if (content.length > 500) throw new WatchPartyError("Message cannot exceed 500 characters", 400);
  const member = await prisma.watchPartyMember.findUnique({
    where: { partyId_userId: { partyId, userId } },
    include: { party: { select: { status: true } } }
  });
  if (!member || member.leftAt || member.party.status !== "ACTIVE") {
    throw new WatchPartyError("You are not an active member of this party", 403);
  }
  return prisma.watchPartyMessage.create({
    data: { partyId, userId, content },
    select: {
      id: true,
      content: true,
      createdAt: true,
      user: { select: publicUserSelect }
    }
  });
}

export async function transferHost(partyId: number, hostUserId: number, targetUserId: number) {
  if (!Number.isInteger(targetUserId) || targetUserId <= 0 || targetUserId === hostUserId) {
    throw new WatchPartyError("Select another member", 400);
  }
  const party = await prisma.watchParty.findUnique({
    where: { id: partyId },
    include: { members: { where: { userId: targetUserId, leftAt: null }, select: { id: true } } }
  });
  if (!party || party.status !== "ACTIVE") throw new WatchPartyError("The watch party is unavailable", 410);
  if (party.hostUserId !== hostUserId) throw new WatchPartyError("You are not the host of this party", 403);
  if (party.members.length === 0) throw new WatchPartyError("Member not found in this party", 404);

  await prisma.$transaction([
    prisma.watchParty.update({ where: { id: partyId }, data: { hostUserId: targetUserId } }),
    prisma.watchPartyMember.updateMany({
      where: { partyId, userId: hostUserId },
      data: { role: "MEMBER" }
    }),
    prisma.watchPartyMember.updateMany({
      where: { partyId, userId: targetUserId },
      data: { role: "HOST" }
    })
  ]);
}

export async function leaveParty(partyId: number, userId: number, onlineIds: number[]) {
  const party = await prisma.watchParty.findUnique({
    where: { id: partyId },
    include: {
      movie: { select: { duration: true } },
      members: {
        where: { userId: { in: onlineIds.filter((id) => id !== userId) }, leftAt: null },
        orderBy: { joinedAt: "asc" },
        select: { userId: true }
      }
    }
  });
  if (!party || party.status !== "ACTIVE") return null;

  await prisma.watchPartyMember.updateMany({
    where: { partyId, userId },
    data: { leftAt: new Date(), lastSeenAt: new Date(), role: "MEMBER" }
  });
  if (party.hostUserId !== userId) return { ended: false, newHostUserId: null };

  const nextHost = party.members[0]?.userId;
  if (nextHost) {
    await prisma.$transaction([
      prisma.watchParty.update({ where: { id: partyId }, data: { hostUserId: nextHost } }),
      prisma.watchPartyMember.updateMany({
        where: { partyId, userId: nextHost },
        data: { role: "HOST" }
      })
    ]);
    return { ended: false, newHostUserId: nextHost };
  }

  const now = new Date();
  await prisma.watchParty.update({
    where: { id: partyId },
    data: {
      status: "ENDED",
      endedAt: now,
      playbackState: "PAUSED",
      playbackPosition: currentPosition(party, now),
      playbackUpdatedAt: now,
      version: { increment: 1 }
    }
  });
  await prisma.watchPartyInvitation.deleteMany({ where: { partyId } });
  return { ended: true, newHostUserId: null };
}
