import { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required"
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        id: req.user.id
      },
      select: {
        role: true
      }
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    if (user.role !== "ADMIN") {
      return res.status(403).json({
        message: "Admin access required"
      });
    }

    next();
  } catch {
    return res.status(500).json({
      message: "Authorization failed"
    });
  }
}