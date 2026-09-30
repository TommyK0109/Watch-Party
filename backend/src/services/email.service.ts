import "dotenv/config";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

const publicDeliveryError = "We could not send the verification email. Please try again later.";

export class EmailDeliveryError extends Error {
  readonly code = "EMAIL_DELIVERY_FAILED";

  constructor(message = publicDeliveryError, options?: ErrorOptions) {
    super(message, options);
    this.name = "EmailDeliveryError";
  }
}

let transporter: Transporter | undefined;

function getTransporter() {
  if (transporter) return transporter;

  const requiredVariables = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD"] as const;
  const missingVariables = requiredVariables.filter((name) => !process.env[name]?.trim());
  if (missingVariables.length > 0) {
    console.error("Email delivery configuration is incomplete", {
      missingVariables
    });
    throw new EmailDeliveryError();
  }

  const port = Number(process.env.SMTP_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error("Email delivery configuration has an invalid SMTP_PORT");
    throw new EmailDeliveryError();
  }

  const secureValue = process.env.SMTP_SECURE?.trim().toLowerCase() || "false";
  if (secureValue !== "true" && secureValue !== "false") {
    console.error("Email delivery configuration has an invalid SMTP_SECURE value");
    throw new EmailDeliveryError();
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: secureValue === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    }
  });

  return transporter;
}

export async function verifyEmailTransport() {
  try {
    await getTransporter().verify();
  } catch (error) {
    if (error instanceof EmailDeliveryError) throw error;
    logEmailProviderError("SMTP startup verification failed", error);
    throw new EmailDeliveryError(publicDeliveryError, { cause: error });
  }
}

export async function sendVerificationEmail(
  email: string,
  otp: string
) {
  try {
    await getTransporter().sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: "Verify your email",
      html: `
        <h2>Verify your email</h2>
        <p>Your verification code is:</p>
        <h1>${otp}</h1>
        <p>This code will expire in 10 minutes.</p>
        <p>If you did not create this account, you can ignore this email.</p>
      `
    });
  } catch (error) {
    if (error instanceof EmailDeliveryError) throw error;
    logEmailProviderError("Verification email delivery failed", error);
    throw new EmailDeliveryError(publicDeliveryError, { cause: error });
  }
}

export async function sendPasswordResetEmail(
  email: string,
  otp: string
) {
  try {
    await getTransporter().sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: "Reset your WatchParty password",
      text: `Your WatchParty password reset code is ${otp}. It expires in 10 minutes. If you did not request this, you can ignore this email.`,
      html: `
        <h2>Reset your password</h2>
        <p>Your password reset code is:</p>
        <h1>${otp}</h1>
        <p>This code will expire in 10 minutes.</p>
        <p>If you did not request a password reset, you can ignore this email.</p>
      `
    });
  } catch (error) {
    if (error instanceof EmailDeliveryError) throw error;
    logEmailProviderError("Password reset email delivery failed", error);
    throw new EmailDeliveryError("We could not send the password reset email. Please try again later.", { cause: error });
  }
}

function logEmailProviderError(context: string, error: unknown) {
  const providerError = error as {
    message?: unknown;
    code?: unknown;
    command?: unknown;
    responseCode?: unknown;
  };
  const smtpUser = process.env.SMTP_USER || "";
  const rawMessage = String(providerError?.message || "Unknown email provider error");
  const message = smtpUser
    ? rawMessage.replaceAll(smtpUser, "[redacted]")
    : rawMessage;

  console.error(context, {
    message,
    code: providerError?.code,
    command: providerError?.command,
    responseCode: providerError?.responseCode
  });
}
