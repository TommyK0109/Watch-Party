import { prisma } from "../lib/prisma";
import { joinParty, WatchPartyError } from "./watchParty.service";

const INVITATION_LIFETIME_MS = 5 * 60 * 1000;

const invitationInclude = {
  inviter: { select: { id: true, username: true, name: true } },
  party: {
    select: {
      code: true,
      movie: { select: { id: true, title: true, thumbnail: true } }
    }
  }
} as const;

export async function deleteExpiredInvitations() {
  await prisma.watchPartyInvitation.deleteMany({ where: { expiresAt: { lte: new Date() } } });
}

function invitationDto(invitation: {
  id: number;
  createdAt: Date;
  expiresAt: Date;
  dismissedAt: Date | null;
  inviter: { id: number; username: string; name: string | null };
  party: { code: string; movie: { id: number; title: string; thumbnail: string | null } };
}) {
  return {
    id: invitation.id,
    code: invitation.party.code,
    url: `/watch-party/${invitation.party.code}`,
    movie: invitation.party.movie,
    inviter: invitation.inviter,
    createdAt: invitation.createdAt,
    expiresAt: invitation.expiresAt,
    dismissedAt: invitation.dismissedAt
  };
}

export async function createInvitation(code: string, hostUserId: number, rawIdentifier: string) {
  const identifier = rawIdentifier.trim();
  if (!identifier || identifier.length > 254) {
    throw new WatchPartyError("Enter a username or email address", 400);
  }
  const party = await prisma.watchParty.findUnique({
    where: { code: code.trim().toUpperCase() },
    select: { id: true, status: true, hostUserId: true, expiresAt: true }
  });
  if (!party || party.status !== "ACTIVE" || (party.expiresAt && party.expiresAt <= new Date())) {
    throw new WatchPartyError("Watch party is not active", 410);
  }
  if (party.hostUserId !== hostUserId) {
    throw new WatchPartyError("Only the host can invite people", 403);
  }
  const recipient = await prisma.user.findFirst({
    where: {
      OR: [
        { username: { equals: identifier, mode: "insensitive" } },
        { email: { equals: identifier, mode: "insensitive" } }
      ]
    },
    select: { id: true, emailVerifiedAt: true }
  });
  if (!recipient || !recipient.emailVerifiedAt) {
    throw new WatchPartyError("No verified user found with that username or email", 404);
  }
  if (recipient.id === hostUserId) throw new WatchPartyError("You cannot invite yourself", 400);
  const member = await prisma.watchPartyMember.findUnique({
    where: { partyId_userId: { partyId: party.id, userId: recipient.id } },
    select: { leftAt: true }
  });
  if (member && !member.leftAt) throw new WatchPartyError("This user is already in the party", 409);

  const now = new Date();
  const invitation = await prisma.watchPartyInvitation.upsert({
    where: { partyId_inviteeUserId: { partyId: party.id, inviteeUserId: recipient.id } },
    create: {
      partyId: party.id,
      inviterUserId: hostUserId,
      inviteeUserId: recipient.id,
      expiresAt: new Date(now.getTime() + INVITATION_LIFETIME_MS)
    },
    update: {
      inviterUserId: hostUserId,
      createdAt: now,
      expiresAt: new Date(now.getTime() + INVITATION_LIFETIME_MS),
      dismissedAt: null
    },
    include: invitationInclude
  });
  return { inviteeUserId: recipient.id, invitation: invitationDto(invitation) };
}

export async function listInvitations(userId: number) {
  await deleteExpiredInvitations();
  const invitations = await prisma.watchPartyInvitation.findMany({
    where: { inviteeUserId: userId, party: { status: "ACTIVE" } },
    orderBy: { createdAt: "desc" },
    include: invitationInclude
  });
  return invitations.map(invitationDto);
}

async function getAvailableInvitation(id: number, userId: number) {
  if (!Number.isInteger(id) || id <= 0) throw new WatchPartyError("Invitation not found", 404);
  const invitation = await prisma.watchPartyInvitation.findUnique({
    where: { id },
    select: { id: true, inviteeUserId: true, expiresAt: true, party: { select: { code: true, status: true } } }
  });
  if (!invitation || invitation.inviteeUserId !== userId || invitation.expiresAt <= new Date() || invitation.party.status !== "ACTIVE") {
    throw new WatchPartyError("This invitation is no longer available", 410);
  }
  return invitation;
}

export async function dismissInvitation(id: number, userId: number) {
  await getAvailableInvitation(id, userId);
  await prisma.watchPartyInvitation.update({ where: { id }, data: { dismissedAt: new Date() } });
}

export async function acceptInvitation(id: number, userId: number) {
  const invitation = await getAvailableInvitation(id, userId);
  await joinParty(invitation.party.code, userId);
  await prisma.watchPartyInvitation.delete({ where: { id } });
  return { code: invitation.party.code, url: `/watch-party/${invitation.party.code}` };
}
