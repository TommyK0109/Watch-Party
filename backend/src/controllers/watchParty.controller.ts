import type { Request, Response } from "express";
import * as watchPartyService from "../services/watchParty.service";
import * as invitationService from "../services/watchPartyInvitation.service";
import { notifyUserOfInvitation } from "../lib/socket";

function respondWithError(res: Response, error: unknown) {
  if (error instanceof watchPartyService.WatchPartyError) {
    return res.status(error.status).json({ message: error.message });
  }
  console.error(error);
  return res.status(500).json({ message: "Watch party request failed" });
}

export async function createWatchParty(req: Request, res: Response) {
  try {
    const party = await watchPartyService.createParty(req.user!.id, Number(req.body?.movieId));
    return res.status(201).json({
      code: party.code,
      url: `/watch-party/${party.code}`,
      movie: party.movie
    });
  } catch (error) {
    return respondWithError(res, error);
  }
}

export async function getWatchParty(req: Request, res: Response) {
  try {
    return res.json(await watchPartyService.getPartyPreview(String(req.params.code || "")));
  } catch (error) {
    return respondWithError(res, error);
  }
}

export async function sendWatchPartyInvitation(req: Request, res: Response) {
  try {
    const result = await invitationService.createInvitation(
      String(req.params.code || ""),
      req.user!.id,
      String(req.body?.identifier || "")
    );
    notifyUserOfInvitation(result.inviteeUserId);
    return res.status(201).json(result.invitation);
  } catch (error) {
    return respondWithError(res, error);
  }
}

export async function getWatchPartyInvitations(req: Request, res: Response) {
  try {
    return res.json({ data: await invitationService.listInvitations(req.user!.id) });
  } catch (error) {
    return respondWithError(res, error);
  }
}

export async function dismissWatchPartyInvitation(req: Request, res: Response) {
  try {
    await invitationService.dismissInvitation(Number(req.params.id), req.user!.id);
    notifyUserOfInvitation(req.user!.id);
    return res.json({ message: "Invitation saved in notifications" });
  } catch (error) {
    return respondWithError(res, error);
  }
}

export async function acceptWatchPartyInvitation(req: Request, res: Response) {
  try {
    const result = await invitationService.acceptInvitation(Number(req.params.id), req.user!.id);
    notifyUserOfInvitation(req.user!.id);
    return res.json(result);
  } catch (error) {
    return respondWithError(res, error);
  }
}
