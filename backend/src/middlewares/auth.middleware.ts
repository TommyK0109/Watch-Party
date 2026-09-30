import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../lib/jwt";
import { sessionCookieNames } from "../lib/tabSession";

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const cookies = sessionCookieNames(req.get("x-tab-session"));
    const token = req.cookies[cookies.access];

    if (!token) {
      return res.status(401).json({
        message: "Authentication required"
      });
    }

    const payload = verifyAccessToken(token);

    req.user = {
      id: payload.userId
    };

    next();
  } catch {
    return res.status(401).json({
      message: "Invalid or expired access token"
    });
  }
}
