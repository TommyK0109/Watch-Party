import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import {
  acceptWatchPartyInvitation,
  createWatchParty,
  dismissWatchPartyInvitation,
  getWatchParty,
  getWatchPartyInvitations,
  sendWatchPartyInvitation
} from "../controllers/watchParty.controller";

const router = Router();

router.use(requireAuth);
router.post("/", createWatchParty);
router.get("/invitations", getWatchPartyInvitations);
router.post("/invitations/:id/accept", acceptWatchPartyInvitation);
router.post("/invitations/:id/dismiss", dismissWatchPartyInvitation);
router.post("/:code/invitations", sendWatchPartyInvitation);
router.get("/:code", getWatchParty);

export default router;
