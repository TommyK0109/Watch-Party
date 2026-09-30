"use client";

import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { fetchWithTabSession } from "@/lib/tabSession";

type Mode = "signin" | "signup" | "verify" | "forgot" | "reset";
type EntryMode = Exclude<Mode, "verify">;

interface SignInModalProps {
  isOpen: boolean;
  initialMode: EntryMode;
  onClose: () => void;
  onSignedIn: (user: { username: string; email: string }) => void;
}

interface AuthResponse {
  message?: string;
  user?: { username: string; email: string };
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

export default function SignInModal({ isOpen, initialMode, onClose, onSignedIn }: SignInModalProps) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [isPasswordVisible, setPasswordVisible] = useState(false);
  const [message, setMessage] = useState<{ text: string; kind: "success" | "error" } | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => firstFieldRef.current?.focus(), 50);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, mode, onClose]);

  async function request(path: string, body: Record<string, string>): Promise<AuthResponse> {
    const response = await fetchWithTabSession(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => ({}))) as AuthResponse;
    if (!response.ok) throw new Error(data.message || "Something went wrong. Please try again.");
    return data;
  }

  function switchMode(nextMode: EntryMode | "forgot") {
    setMode(nextMode);
    setMessage(null);
    setPasswordVisible(false);
    setPassword("");
    setConfirmPassword("");
    setCode("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setSubmitting(true);

    try {
      if (mode === "signup") {
        const data = await request("/auth/register", { username, email, password });
        setCode("");
        setMode("verify");
        setMessage({ text: data.message || "Verification code sent.", kind: "success" });
      } else if (mode === "verify") {
        const data = await request("/auth/verify-email", { email, code });
        setMode("signin");
        setPassword("");
        setCode("");
        setMessage({ text: data.message || "Email verified. You can now sign in.", kind: "success" });
      } else if (mode === "forgot") {
        const data = await request("/auth/forgot-password", { email });
        setCode("");
        setMode("reset");
        setMessage({ text: data.message || "If that account exists, a reset code was sent.", kind: "success" });
      } else if (mode === "reset") {
        if (password !== confirmPassword) throw new Error("The new passwords do not match.");
        const data = await request("/auth/reset-password", { email, code, newPassword: password });
        setMode("signin");
        setPassword("");
        setConfirmPassword("");
        setCode("");
        setMessage({ text: data.message || "Password reset successfully. You can now sign in.", kind: "success" });
      } else {
        const data = await request("/auth/login", { email, password });
        if (!data.user) throw new Error("The server returned an invalid sign-in response.");
        onSignedIn(data.user);
        window.dispatchEvent(new Event("watchparty:auth-changed"));
        onClose();
      }
    } catch (error) {
      const text = error instanceof TypeError && error.message === "Failed to fetch"
        ? "Cannot reach the authentication service. Make sure the backend is running."
        : error instanceof Error ? error.message : "Something went wrong. Please try again.";
      setMessage({ text, kind: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  async function resendCode() {
    setMessage(null);
    setSubmitting(true);
    try {
      const data = await request("/auth/resend-verification", { email });
      setMessage({ text: data.message || "A new code was sent.", kind: "success" });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Could not resend the code.", kind: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  async function resendResetCode() {
    setMessage(null);
    setSubmitting(true);
    try {
      const data = await request("/auth/forgot-password", { email });
      setMessage({ text: data.message || "If that account exists, a new reset code was sent.", kind: "success" });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Could not resend the reset code.", kind: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  if (!isOpen) return null;

  const title = mode === "signin"
    ? "Welcome back"
    : mode === "signup"
      ? "Join WatchParty"
      : mode === "verify"
        ? "Verify your email"
        : mode === "forgot"
          ? "Forgot your password?"
          : "Create a new password";
  const subtitle = mode === "verify"
    ? `Enter the six-digit code sent to ${email}.`
    : mode === "reset"
      ? `Enter the six-digit code sent to ${email}, then choose a new password.`
      : mode === "forgot"
        ? "Enter your email and we'll send you a six-digit reset code."
        : mode === "signup"
          ? "Create an account to save movies and host watch parties."
          : "Sign in to continue your movie night.";
  const inputClass = "h-12 w-full rounded-xl border border-white/10 bg-white/[0.055] px-4 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#ee0a70] focus:bg-white/[0.075] focus:ring-4 focus:ring-[#ee0a70]/10 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
      onMouseDown={handleBackdropClick}
    >
      <div className="relative w-full max-w-[440px] overflow-hidden rounded-[26px] border border-white/10 bg-[#0d0a11] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.7)] sm:p-8" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <div className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full bg-[#ee0a70]/20 blur-3xl" />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close authentication dialog"
          className="absolute right-5 top-5 z-10 grid size-9 place-items-center rounded-full border border-white/10 text-xl leading-none text-white/60 transition hover:border-white/25 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee0a70]"
        >
          &times;
        </button>

        <div className="relative">
          <a href="#home" className="font-brand text-lg font-bold tracking-[-0.045em] text-white" tabIndex={-1}>
            Watch<span className="text-[#ee0a70]">Party</span>
          </a>
          <h2 id="auth-title" className="mt-8 text-[28px] font-semibold tracking-[-0.035em] text-white">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-white/55">{subtitle}</p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            {mode === "signup" && (
              <label className="block">
                <span className="mb-2 block text-xs font-medium text-white/75">Username</span>
                <input
                  ref={firstFieldRef}
                  className={inputClass}
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  minLength={3}
                  maxLength={30}
                  pattern="[A-Za-z0-9_]+"
                  autoComplete="username"
                  placeholder="movie_fan"
                  required
                />
              </label>
            )}

            {mode !== "verify" && mode !== "reset" && (
              <label className="block">
                <span className="mb-2 block text-xs font-medium text-white/75">Email address</span>
                <input
                  ref={mode === "signin" || mode === "forgot" ? firstFieldRef : undefined}
                  className={inputClass}
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                />
              </label>
            )}

            {mode !== "verify" && mode !== "forgot" && (
              <label className="block">
                <span className="mb-2 block text-xs font-medium text-white/75">{mode === "reset" ? "New password" : "Password"}</span>
                <span className="relative block">
                  <input
                    className={`${inputClass} pr-16`}
                    type={isPasswordVisible ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    minLength={6}
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    placeholder="At least 6 characters"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setPasswordVisible((visible) => !visible)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-[11px] font-semibold text-[#ff4d9a] transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee0a70]"
                  >
                    {isPasswordVisible ? "Hide" : "Show"}
                  </button>
                </span>
                {(mode === "signup" || mode === "reset") && <span className="mt-2 block text-[11px] leading-4 text-white/40">Use uppercase, lowercase, a number, and a special character.</span>}
              </label>
            )}

            {mode === "reset" && (
              <label className="block">
                <span className="mb-2 block text-xs font-medium text-white/75">Confirm new password</span>
                <input
                  className={inputClass}
                  type={isPasswordVisible ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  minLength={6}
                  autoComplete="new-password"
                  placeholder="Repeat your new password"
                  required
                />
              </label>
            )}

            {(mode === "verify" || mode === "reset") && (
              <label className="block">
                <span className="mb-2 block text-xs font-medium text-white/75">{mode === "reset" ? "Password reset code" : "Verification code"}</span>
                <input
                  ref={firstFieldRef}
                  className={`${inputClass} text-center font-brand text-xl tracking-[0.45em]`}
                  type="text"
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                />
              </label>
            )}

            {message && (
              <p className={`rounded-xl border px-3.5 py-3 text-xs leading-5 ${message.kind === "success" ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200" : "border-red-400/20 bg-red-400/10 text-red-200"}`} role="status">
                {message.text}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting || ((mode === "verify" || mode === "reset") && code.length !== 6)}
              className="flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#6d20df] to-[#ee0a70] text-sm font-semibold text-white shadow-[0_12px_35px_rgba(238,10,112,0.22)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5ca3] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0a11] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting
                ? "Please wait..."
                : mode === "signin"
                  ? "Sign in"
                  : mode === "signup"
                    ? "Create account"
                    : mode === "verify"
                      ? "Verify email"
                      : mode === "forgot"
                        ? "Send reset code"
                        : "Reset password"}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-white/50">
            {mode === "signin" && (
              <span className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
                <button type="button" onClick={() => switchMode("forgot")} className="font-semibold text-[#ff4d9a] hover:text-white">Forgot password?</button>
                <span className="text-white/20">&bull;</span>
                <span>New here? <button type="button" onClick={() => switchMode("signup")} className="font-semibold text-[#ff4d9a] hover:text-white">Create an account</button></span>
              </span>
            )}
            {mode === "signup" && <>Already have an account? <button type="button" onClick={() => switchMode("signin")} className="font-semibold text-[#ff4d9a] hover:text-white">Sign in</button></>}
            {mode === "forgot" && <button type="button" onClick={() => switchMode("signin")} className="font-semibold text-white/65 hover:text-white">Back to sign in</button>}
            {mode === "verify" && (
              <span className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
                <button type="button" onClick={resendCode} disabled={isSubmitting} className="font-semibold text-[#ff4d9a] hover:text-white disabled:opacity-50">Resend code</button>
                <span className="text-white/20">&bull;</span>
                <button type="button" onClick={() => switchMode("signin")} className="font-semibold text-white/65 hover:text-white">Back to sign in</button>
              </span>
            )}
            {mode === "reset" && (
              <span className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
                <button type="button" onClick={resendResetCode} disabled={isSubmitting} className="font-semibold text-[#ff4d9a] hover:text-white disabled:opacity-50">Send a new code</button>
                <span className="text-white/20">&bull;</span>
                <button type="button" onClick={() => switchMode("signin")} className="font-semibold text-white/65 hover:text-white">Back to sign in</button>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
