import bcrypt from "bcrypt";
import { randomInt } from "crypto";
import { prisma } from "../lib/prisma";
import { sendPasswordResetEmail } from "./email.service";

const resetCodeLifetimeMs = 10 * 60 * 1000;
const resendCooldownMs = 60 * 1000;
const maxResetAttempts = 5;

/**
 * Always completes without revealing whether the email belongs to an account.
 */
export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return;

  const existingReset = await prisma.passwordReset.findUnique({
    where: { userId: user.id }
  });

  // Silently honor the cooldown so this endpoint cannot be used to spam users.
  if (existingReset && existingReset.lastSentAt > new Date(Date.now() - resendCooldownMs)) {
    return;
  }

  const code = createResetCode();
  const codeHash = await bcrypt.hash(code, 12);
  const expiresAt = new Date(Date.now() + resetCodeLifetimeMs);

  await prisma.passwordReset.upsert({
    where: { userId: user.id },
    create: { userId: user.id, codeHash, expiresAt },
    update: { codeHash, expiresAt, attempts: 0, lastSentAt: new Date() }
  });

  await sendPasswordResetEmail(email, code);
}

export async function resetPassword(email: string, code: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw invalidResetCodeError();

  const passwordReset = await prisma.passwordReset.findUnique({
    where: { userId: user.id }
  });

  if (!passwordReset || passwordReset.expiresAt < new Date() || passwordReset.attempts >= maxResetAttempts) {
    throw invalidResetCodeError();
  }

  const valid = await bcrypt.compare(code, passwordReset.codeHash);
  if (!valid) {
    await prisma.passwordReset.update({
      where: { userId: user.id },
      data: { attempts: { increment: 1 } }
    });
    throw invalidResetCodeError();
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash }
    });
    await tx.passwordReset.delete({ where: { userId: user.id } });
  });
}

function createResetCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function invalidResetCodeError() {
  return new Error("Invalid or expired password reset code. Request a new one.");
}
