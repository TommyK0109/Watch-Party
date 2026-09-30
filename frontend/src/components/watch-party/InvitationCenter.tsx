"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { apiFetch, responseMessage } from "@/lib/api";
import { createWatchPartySocket } from "@/lib/watchPartySocket";

interface Invitation {
  id: number;
  code: string;
  url: string;
  movie: { id: number; title: string; thumbnail: string | null };
  inviter: { id: number; username: string; name: string | null };
  createdAt: string;
  expiresAt: string;
  dismissedAt: string | null;
}

interface InvitationContextValue {
  count: number;
  open: boolean;
  setOpen: (open: boolean) => void;
}

const InvitationContext = createContext<InvitationContextValue | null>(null);

export function useInvitations() {
  const value = useContext(InvitationContext);
  if (!value) throw new Error("InvitationCenter is missing");
  return value;
}

export function InvitationBell() {
  const { count, open, setOpen } = useInvitations();
  return (
    <button type="button" aria-label={`Notifications${count ? `, ${count} invitations` : ""}`} aria-expanded={open} onClick={() => setOpen(!open)} className="relative rounded-lg border border-white/10 px-3 py-2 text-xs text-white/75 transition hover:border-[#ee0a70]/50 hover:text-white">
      Notifications
      {count > 0 && <span className="ml-2 rounded-full bg-[#ee0a70] px-1.5 py-0.5 text-[10px] font-bold text-white">{count}</span>}
    </button>
  );
}

function remainingTime(expiresAt: string, now: number) {
  const seconds = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function InvitationCenter({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [userId, setUserId] = useState<number | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [popupId, setPopupId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());

  const checkSession = useCallback(async () => {
    try {
      const response = await apiFetch("/auth/me");
      if (!response.ok) throw new Error("Signed out");
      const user = await response.json() as { id: number };
      setUserId(user.id);
    } catch {
      setUserId(null);
      setInvitations([]);
      setPopupId(null);
      setOpen(false);
    }
  }, []);

  const loadInvitations = useCallback(async () => {
    try {
      const response = await apiFetch("/watch-parties/invitations");
      if (response.status === 401) {
        void checkSession();
        return;
      }
      if (!response.ok) return;
      const body = await response.json() as { data: Invitation[] };
      setInvitations(body.data);
      setPopupId((current) => {
        if (current && body.data.some((invitation) => invitation.id === current && !invitation.dismissedAt)) return current;
        return body.data.find((invitation) => !invitation.dismissedAt)?.id ?? null;
      });
    } catch {
      // Keep the current notifications until the next connection attempt.
    }
  }, [checkSession]);

  useEffect(() => {
    const initialCheck = window.setTimeout(() => void checkSession(), 0);
    const sessionRefresh = window.setInterval(() => void checkSession(), 30_000);
    window.addEventListener("watchparty:auth-changed", checkSession);
    return () => {
      window.clearTimeout(initialCheck);
      window.clearInterval(sessionRefresh);
      window.removeEventListener("watchparty:auth-changed", checkSession);
    };
  }, [checkSession]);

  useEffect(() => {
    if (userId == null) return;
    const initialLoad = window.setTimeout(() => void loadInvitations(), 0);
    const socket = createWatchPartySocket();
    socket.on("invitation:changed", () => void loadInvitations());
    socket.on("connect_error", async (socketError) => {
      if (!/auth|token/i.test(socketError.message)) return;
      const response = await apiFetch("/auth/me").catch(() => null);
      if (response?.ok) socket.connect();
      else void checkSession();
    });
    socket.connect();
    const refresh = window.setInterval(() => void loadInvitations(), 10_000);
    const clock = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(refresh);
      window.clearInterval(clock);
      socket.disconnect();
    };
  }, [userId, loadInvitations, checkSession]);

  const available = invitations.filter((invitation) => new Date(invitation.expiresAt).getTime() > now);
  const popup = available.find((invitation) => invitation.id === popupId && !invitation.dismissedAt);

  async function dismiss(invitation: Invitation) {
    setBusyId(invitation.id);
    setError("");
    try {
      const response = await apiFetch(`/watch-parties/invitations/${invitation.id}/dismiss`, { method: "POST" });
      if (!response.ok) throw new Error(await responseMessage(response, "Could not save the invitation"));
      setInvitations((current) => current.map((item) => item.id === invitation.id ? { ...item, dismissedAt: new Date().toISOString() } : item));
      setPopupId(null);
    } catch (dismissError) {
      setError(dismissError instanceof Error ? dismissError.message : "Could not save the invitation");
    } finally {
      setBusyId(null);
    }
  }

  async function accept(invitation: Invitation) {
    setBusyId(invitation.id);
    setError("");
    try {
      const response = await apiFetch(`/watch-parties/invitations/${invitation.id}/accept`, { method: "POST" });
      if (!response.ok) throw new Error(await responseMessage(response, "Could not join the party"));
      const body = await response.json() as { url: string };
      setInvitations((current) => current.filter((item) => item.id !== invitation.id));
      setPopupId(null);
      setOpen(false);
      router.push(body.url);
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : "Could not join the party");
      void loadInvitations();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <InvitationContext.Provider value={{ count: available.length, open, setOpen }}>
      {children}
      {userId != null && open && (
        <aside className="fixed right-4 top-20 z-[130] w-[min(380px,calc(100vw-2rem))] rounded-2xl border border-white/15 bg-[#100c16] p-4 text-white shadow-2xl" aria-label="Watch party notifications">
          <div className="flex items-center justify-between gap-3">
            <div><h2 className="text-base font-semibold">Notifications</h2><p className="text-xs text-white/45">Invitations are available for five minutes.</p></div>
            <button onClick={() => setOpen(false)} aria-label="Close notifications" className="rounded-lg px-2 py-1 text-white/50 hover:text-white">×</button>
          </div>
          <div className="mt-4 max-h-[60vh] space-y-3 overflow-y-auto">
            {available.length === 0 && <p className="rounded-xl border border-white/10 p-5 text-center text-sm text-white/45">No active invitations.</p>}
            {available.map((invitation) => (
              <div key={invitation.id} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                <p className="text-sm font-medium">{invitation.inviter.name || invitation.inviter.username} invited you to watch {invitation.movie.title}</p>
                <p className="mt-1 text-xs text-white/45">Room {invitation.code} · Expires in {remainingTime(invitation.expiresAt, now)}</p>
                <button disabled={busyId === invitation.id} onClick={() => void accept(invitation)} className="mt-3 rounded-lg bg-[#7027e4] px-4 py-2 text-xs font-semibold disabled:opacity-40">Join room</button>
              </div>
            ))}
          </div>
          {error && <p role="alert" className="mt-3 text-xs text-red-300">{error}</p>}
        </aside>
      )}
      {userId != null && popup && (
        <div role="dialog" aria-labelledby="invitation-popup-title" className="fixed bottom-5 right-5 z-[140] w-[min(390px,calc(100vw-2.5rem))] rounded-2xl border border-[#ee0a70]/35 bg-[#130d1b] p-5 text-white shadow-[0_20px_70px_rgba(0,0,0,0.7)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#ff6cae]">Watch party invitation</p>
          <h2 id="invitation-popup-title" className="mt-2 text-lg font-semibold">{popup.inviter.name || popup.inviter.username} invited you</h2>
          <p className="mt-2 text-sm text-white/60">Watch {popup.movie.title} together. Expires in {remainingTime(popup.expiresAt, now)}.</p>
          <div className="mt-4 flex gap-2">
            <button disabled={busyId === popup.id} onClick={() => void accept(popup)} className="flex-1 rounded-xl bg-gradient-to-r from-[#7027e4] to-[#ee0a70] py-2.5 text-sm font-semibold disabled:opacity-40">Yes, join now</button>
            <button disabled={busyId === popup.id} onClick={() => void dismiss(popup)} className="flex-1 rounded-xl border border-white/15 py-2.5 text-sm text-white/75 disabled:opacity-40">No, save for later</button>
          </div>
          {error && <p role="alert" className="mt-3 text-xs text-red-300">{error}</p>}
        </div>
      )}
    </InvitationContext.Provider>
  );
}
