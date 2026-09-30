"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { apiFetch, responseMessage } from "@/lib/api";

export function roomCodeFromInput(raw: string) {
  const value = raw.trim();
  if (/^[A-Z2-9]{6}$/i.test(value)) return value.toUpperCase();
  try {
    const url = new URL(value);
    const match = url.pathname.match(/^\/watch-party\/([A-Z2-9]{6})\/?$/i);
    if ((url.protocol === "http:" || url.protocol === "https:") && match) return match[1].toUpperCase();
  } catch {
    return null;
  }
  return null;
}

export default function JoinPartyForm({ isSignedIn, onRequireSignIn, onJoined }: {
  isSignedIn: boolean;
  onRequireSignIn: () => void;
  onJoined?: () => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);

  async function join(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = roomCodeFromInput(value);
    if (!code) {
      setError("Enter a six-character code or a watch party room link.");
      return;
    }
    if (!isSignedIn) {
      onRequireSignIn();
      return;
    }
    setJoining(true);
    setError("");
    try {
      const response = await apiFetch(`/watch-parties/${code}`);
      if (!response.ok) {
        if (response.status === 401) {
          onRequireSignIn();
          return;
        }
        throw new Error(await responseMessage(response, "Could not join this party"));
      }
      onJoined?.();
      router.push(`/watch-party/${code}`);
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : "Could not join this party");
    } finally {
      setJoining(false);
    }
  }

  return (
    <form onSubmit={(event) => void join(event)} className="space-y-3">
      <label className="block text-xs font-medium text-white/65" htmlFor="join-party-value">Room code or invite link</label>
      <input id="join-party-value" value={value} onChange={(event) => setValue(event.target.value)} placeholder="ABCD12 or https://.../watch-party/ABCD12" autoComplete="off" className="h-12 w-full rounded-xl border border-white/15 bg-black/30 px-4 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#ee0a70]" />
      {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
      <button disabled={joining || !value.trim()} className="h-11 w-full rounded-xl bg-gradient-to-r from-[#7027e4] to-[#ee0a70] text-sm font-semibold text-white disabled:opacity-40">
        {joining ? "Joining…" : isSignedIn ? "Join party" : "Sign in to join"}
      </button>
    </form>
  );
}
