CREATE TABLE "WatchPartyInvitation" (
    "id" SERIAL NOT NULL,
    "partyId" INTEGER NOT NULL,
    "inviterUserId" INTEGER NOT NULL,
    "inviteeUserId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "dismissedAt" TIMESTAMP(3),

    CONSTRAINT "WatchPartyInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WatchPartyInvitation_partyId_inviteeUserId_key" ON "WatchPartyInvitation"("partyId", "inviteeUserId");
CREATE INDEX "WatchPartyInvitation_inviteeUserId_expiresAt_idx" ON "WatchPartyInvitation"("inviteeUserId", "expiresAt");
CREATE INDEX "WatchPartyInvitation_expiresAt_idx" ON "WatchPartyInvitation"("expiresAt");

ALTER TABLE "WatchPartyInvitation" ADD CONSTRAINT "WatchPartyInvitation_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "WatchParty"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WatchPartyInvitation" ADD CONSTRAINT "WatchPartyInvitation_inviterUserId_fkey" FOREIGN KEY ("inviterUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WatchPartyInvitation" ADD CONSTRAINT "WatchPartyInvitation_inviteeUserId_fkey" FOREIGN KEY ("inviteeUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
