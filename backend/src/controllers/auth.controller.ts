import { Request, Response } from "express";
import * as authService from "../services/auth.service";
import * as emailVerificationService from "../services/emailVerification.service";
import * as passwordResetService from "../services/passwordReset.service";
import { EmailDeliveryError } from "../services/email.service";
import { sessionCookieNames } from "../lib/tabSession";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const
};

export async function register(
  req: Request,
  res: Response
) {
  try {
    const { email, password, username } = parseRegistration(req.body);

    const user = await authService.register(
      email,
      password,
      username
    );

    return res.status(201).json({
      message: "Account created. Check your email for the verification code.",
      user
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Registration failed";

    return res.status(error instanceof EmailDeliveryError ? 503 : 400).json({
      message
    });
  }
}

export async function verifyEmail(req: Request, res: Response) {
  try {
    const email = parseEmail(req.body?.email);
    const code = String(req.body?.code || "").trim();
    if (!/^\d{6}$/.test(code)) throw new Error("Enter the 6-digit verification code");

    const user = await emailVerificationService.verifyEmail(email, code);
    return res.json({ message: "Email verified. You can now sign in.", user });
  } catch (error) {
    return res.status(400).json({
      message: error instanceof Error ? error.message : "Email verification failed"
    });
  }
}

export async function resendVerification(req: Request, res: Response) {
  try {
    await emailVerificationService.resendVerification(parseEmail(req.body?.email));
    return res.json({ message: "A new verification code has been sent." });
  } catch (error) {
    return res.status(error instanceof EmailDeliveryError ? 503 : 400).json({
      message: error instanceof Error ? error.message : "Could not resend verification code"
    });
  }
}

export async function requestPasswordReset(req: Request, res: Response) {
  try {
    const email = parseEmail(req.body?.email);
    await passwordResetService.requestPasswordReset(email);

    return res.json({
      message: "If an account exists for that email, a six-digit reset code has been sent."
    });
  } catch (error) {
    return res.status(error instanceof EmailDeliveryError ? 503 : 400).json({
      message: error instanceof Error ? error.message : "Could not request a password reset"
    });
  }
}

export async function resetPassword(req: Request, res: Response) {
  try {
    const email = parseEmail(req.body?.email);
    const code = String(req.body?.code || "").trim();
    const newPassword = String(req.body?.newPassword || "");

    if (!/^\d{6}$/.test(code)) {
      throw new Error("Enter the six-digit password reset code");
    }
    if (!isStrongPassword(newPassword)) {
      throw new Error("Password must be at least 6 characters and include uppercase, lowercase, a number, and a special character");
    }

    await passwordResetService.resetPassword(email, code, newPassword);
    return res.json({ message: "Password reset successfully. You can now sign in." });
  } catch (error) {
    return res.status(400).json({
      message: error instanceof Error ? error.message : "Could not reset password"
    });
  }
}

export async function login(
  req: Request,
  res: Response
) {
  try {
    const cookies = sessionCookieNames(req.get("x-tab-session"));
    const email = parseEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!password) {
      return res.status(400).json({
        message: "Email and password are required"
      });
    }

    const result = await authService.login(
      email,
      password
    );

    res.cookie(
      cookies.access,
      result.accessToken,
      {
        ...cookieOptions,
        maxAge: 15 * 60 * 1000
      }
    );

    res.cookie(
      cookies.refresh,
      result.refreshToken,
      {
        ...cookieOptions,
        maxAge: 7 * 24 * 60 * 60 * 1000
      }
    );

    return res.json({
      message: "Login successful",
      user: result.user
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Login failed";

    return res.status(401).json({
      message
    });
  }
}

export async function logout(
  req: Request,
  res: Response
) {
  try {
    const cookies = sessionCookieNames(req.get("x-tab-session"));
    res.clearCookie(cookies.access, cookieOptions);
    res.clearCookie(cookies.refresh, cookieOptions);
  } catch {
    return res.status(400).json({ message: "Invalid tab session" });
  }

  return res.json({
    message: "Logout successful"
  });
}

export async function me(
  req: Request,
  res: Response
) {
  try {
    const user = await authService.getCurrentUser(
      req.user!.id
    );

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    return res.json(user);
  } catch {
    return res.status(500).json({
      message: "Failed to get user"
    });
  }
}

export async function refresh(
  req: Request,
  res: Response
) {
  try {
    const cookies = sessionCookieNames(req.get("x-tab-session"));
    const refreshToken = req.cookies[cookies.refresh];

    if (!refreshToken) {
      return res.status(401).json({
        message: "Refresh token is missing"
      });
    }

    const accessToken =
      await authService.refreshAccessToken(
        refreshToken
      );

    res.cookie(
      cookies.access,
      accessToken,
      {
        ...cookieOptions,
        maxAge: 15 * 60 * 1000
      }
    );

    return res.json({
      message: "Access token refreshed"
    });
  } catch {
    return res.status(401).json({
      message: "Invalid refresh token"
    });
  }
}

function parseRegistration(body: unknown) {
  const values = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const username = String(values.username || "").trim();
  const email = parseEmail(values.email);
  const password = String(values.password || "");

  if (username.length < 3 || username.length > 30) {
    throw new Error("Username must be between 3 and 30 characters");
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    throw new Error("Username may contain only letters, numbers, and underscores");
  }
  if (!isStrongPassword(password)) {
    throw new Error("Password must be at least 6 characters and include uppercase, lowercase, a number, and a special character");
  }
  return { username, email, password };
}

function parseEmail(value: unknown) {
  const email = String(value || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid email address");
  }
  return email;
}

function isStrongPassword(password: string) {
  return password.length >= 6
    && /[a-z]/.test(password)
    && /[A-Z]/.test(password)
    && /\d/.test(password)
    && /[^A-Za-z0-9]/.test(password);
}
