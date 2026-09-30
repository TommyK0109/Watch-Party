import "dotenv/config";
import jwt from "jsonwebtoken";

function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value;
}

export function signAccessToken(userId: number) {
  return jwt.sign(
    {
      userId
    },
    requiredEnv("JWT_ACCESS_SECRET"),
    {
      expiresIn: "15m"
    }
  );
}

export function signRefreshToken(userId: number) {
  return jwt.sign(
    {
      userId
    },
    requiredEnv("JWT_REFRESH_SECRET"),
    {
      expiresIn: "7d"
    }
  );
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, requiredEnv("JWT_ACCESS_SECRET")) as {
    userId: number;
  };
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, requiredEnv("JWT_REFRESH_SECRET")) as {
    userId: number;
  };
}
