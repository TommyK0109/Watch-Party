import bcrypt from "bcrypt";
import { randomInt } from "crypto";
import { prisma } from "../lib/prisma";
import { sendVerificationEmail } from "./email.service";

const verificationLifetimeMs = 10 * 60 * 1000;
const resendCooldownMs = 60 * 1000;
const maxVerificationAttempts = 5;

const publicUserSelect = {
  id: true,
  username: true,
  email: true,
  name: true,
  role: true,
  emailVerifiedAt: true,
  createdAt: true
} as const;

// Used by signup and by a repeat signup attempt for an unverified account.
export async function sendVerificationCode(userId: number, email: string) {
  const code = createVerificationCode();
  const codeHash = await bcrypt.hash(code, 12);
  const expiresAt = new Date(Date.now() + verificationLifetimeMs);

  await prisma.emailVerification.upsert({
    where: { userId },
    create: { userId, codeHash, expiresAt },
    update: { codeHash, expiresAt, attempts: 0, lastSentAt: new Date() }
  });

  await sendVerificationEmail(email, code);
}

export async function verifyEmail(email: string, code: string) {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) throw new Error("Invalid or expired verification code");
  if (user.emailVerifiedAt) throw new Error("This email is already verified");

  const verification = await prisma.emailVerification.findUnique({
    where: { userId: user.id }
  });

  if (!verification || verification.expiresAt < new Date() || verification.attempts >= maxVerificationAttempts) {
    throw new Error("This verification code has expired. Request a new one.");
  }

  const valid = await bcrypt.compare(code, verification.codeHash);
  if (!valid) {
    await prisma.emailVerification.update({
      where: { userId: user.id },
      data: { attempts: { increment: 1 } }
    });
    throw new Error("Invalid or expired verification code");
  }

  return prisma.$transaction(async (tx) => {
    const verifiedUser = await tx.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date() },
      select: publicUserSelect
    });
    await tx.emailVerification.delete({ where: { userId: user.id } });
    return verifiedUser;
  });
}

export async function resendVerification(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("No account is registered with this email");
  if (user.emailVerifiedAt) throw new Error("This email is already verified");

  const verification = await prisma.emailVerification.findUnique({
    where: { userId: user.id }
  });
  if (verification && verification.lastSentAt > new Date(Date.now() - resendCooldownMs)) {
    throw new Error("Please wait one minute before requesting another code");
  }

  await sendVerificationCode(user.id, email);
}

function createVerificationCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}
