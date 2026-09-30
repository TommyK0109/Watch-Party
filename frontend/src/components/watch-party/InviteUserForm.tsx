"use client";

import { FormEvent, useState } from "react";
import { apiFetch, responseMessage } from "@/lib/api";

export default function InviteUserForm({ code }: { code: string }) {
  const [identifier, setIdentifier] = useState("");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; error: boolean } | null>(null);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!identifier.trim()) return;
    setSending(true);
    setFeedback(null);
    try {
      const response = await apiFetch(`/watch-parties/${code}/invitations`, {
        method: "POST",
        body: JSON.stringify({ identifier: identifier.trim() })
      });
      if (!response.ok) throw new Error(await responseMessage(response, "Could not send invitation"));
      setIdentifier("");
      setFeedback({ text: "Invitation sent. It expires in five minutes.", error: false });
    } catch (error) {
      setFeedback({ text: error instanceof Error ? error.message : "Could not send invitation", error: true });
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={(event) => void send(event)} className="space-y-2">
      <label htmlFor={`invite-${code}`} className="block text-xs font-medium text-white/65">Invite by username or email</label>
      <div className="flex gap-2">
        <input id={`invite-${code}`} value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="Username or email" autoComplete="off" className="h-11 min-w-0 flex-1 rounded-xl border border-white/15 bg-black/30 px-3 text-xs text-white outline-none placeholder:text-white/25 focus:border-[#ee0a70]" />
        <button disabled={sending || !identifier.trim()} className="rounded-xl bg-[#7027e4] px-4 text-xs font-semibold text-white disabled:opacity-40">{sending ? "Sending…" : "Invite"}</button>
      </div>
      {feedback && <p role="status" className={`text-xs ${feedback.error ? "text-red-300" : "text-emerald-300"}`}>{feedback.text}</p>}
    </form>
  );
}
