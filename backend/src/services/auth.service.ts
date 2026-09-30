import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma";
import { sendVerificationCode } from "./emailVerification.service";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken
} from "../lib/jwt";

export async function register(
  email: string,
  password: string,
  username: string
) {
  const existingUser = await prisma.user.findUnique({
    where: {
      email
    }
  });

  if (existingUser) {
    if (!existingUser.emailVerifiedAt) {
      const passwordValid = await bcrypt.compare(password, existingUser.passwordHash);
      if (!passwordValid) throw new Error("Email already exists");

      await sendVerificationCode(existingUser.id, email);
      return prisma.user.findUniqueOrThrow({
        where: { id: existingUser.id },
        select: publicUserSelect
      });
    }
    throw new Error("Email already exists");
  }
  const user = await prisma.user.create({
    data: {
      username,
      email,
      passwordHash: await bcrypt.hash(password, 12),
      name: username
    },
    select: publicUserSelect
  });

  // Keep the unverified account if delivery fails. A repeat signup with the
  // same credentials can generate a fresh code instead of losing the account.
  await sendVerificationCode(user.id, email);

  return user;
}

const publicUserSelect = {
  id: true,
  username: true,
  email: true,
  name: true,
  role: true,
  emailVerifiedAt: true,
  createdAt: true
} as const;

export async function login(
  email: string,
  password: string
) {
  const user = await prisma.user.findUnique({
    where: {
      email
    }
  });

  if (!user) {
    throw new Error("Invalid email or password");
  }

  if (!user.emailVerifiedAt) {
    throw new Error("Please verify your email before signing in");
  }

  const passwordValid = await bcrypt.compare(
    password,
    user.passwordHash
  );

  if (!passwordValid) {
    throw new Error("Invalid email or password");
  }

  const accessToken = signAccessToken(user.id);
  const refreshToken = signRefreshToken(user.id);

  return {
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role
    },
    accessToken,
    refreshToken
  };
}

export async function getCurrentUser(userId: number) {
  return prisma.user.findUnique({
    where: {
      id: userId
    },
    select: {
      id: true,
      username: true,
      email: true,
      name: true,
      role: true,
      emailVerifiedAt: true,
      createdAt: true
    }
  });
}

export async function refreshAccessToken(
  refreshToken: string
) {
  const payload = verifyRefreshToken(refreshToken);

  const user = await prisma.user.findUnique({
    where: {
      id: payload.userId
    }
  });

  if (!user) {
    throw new Error("User not found");
  }

  return signAccessToken(user.id);
}
