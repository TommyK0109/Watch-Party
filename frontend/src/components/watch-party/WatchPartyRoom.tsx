"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import Logo from "@/components/Logo";
import { apiFetch, responseMessage } from "@/lib/api";
import { createWatchPartySocket } from "@/lib/watchPartySocket";
import { useRecordMovieView } from "@/lib/useRecordMovieView";
import InviteUserForm from "./InviteUserForm";
import { InvitationBell } from "./InvitationCenter";

interface PartyMovie {
  id: number;
  title: string;
  thumbnail: string | null;
  videoUrl: string;
  duration: number | null;
}

interface Playback {
  state: "PLAYING" | "PAUSED";
  position: number;
  version: number;
  serverTime: number;
}

interface Member {
  id: number;
  username: string;
  name: string | null;
  role: "HOST" | "MEMBER";
  joinedAt: string;
}

interface ChatMessage {
  id: number;
  content: string;
  createdAt: string;
  user: Pick<Member, "id" | "username" | "name">;
}

type RoomUser = Pick<Member, "id" | "username" | "name">;

interface RoomStatus {
  id: string;
  kind: "JOINED" | "LEFT" | "HOST_TRANSFERRED" | "HOST_ASSIGNED";
  user: RoomUser;
  target?: RoomUser;
  createdAt: string;
}

const CHAT_EMOJI = ["😀", "😂", "🥰", "😍", "😎", "🥳", "😢", "😮", "👍", "👏", "❤️", "🔥", "🎉", "🍿", "🎬", "🙌", "💯", "👀"];

function roomStatusText(status: RoomStatus) {
  const name = status.user.name?.trim() || status.user.username;
  switch (status.kind) {
    case "JOINED": return `${name} joined the room`;
    case "LEFT": return `${name} left the room`;
    case "HOST_TRANSFERRED": return `${name} made ${status.target?.name?.trim() || status.target?.username || "another member"} the host`;
    case "HOST_ASSIGNED": return `${name} is now the host`;
  }
}

interface Snapshot {
  code: string;
  currentUserId: number;
  hostUserId: number;
  movie: PartyMovie;
  playback: Playback;
  members: Member[];
  messages: ChatMessage[];
}

interface Ack {
  ok: boolean;
  message?: string;
}

function expectedPosition(playback: Playback) {
  if (playback.state === "PAUSED") return playback.position;
  return playback.position + Math.max(0, Date.now() - playback.serverTime) / 1000;
}

function formatClock(value: number) {
  const date = new Date(value);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function WatchPartyRoom({ roomCode }: { roomCode: string }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const playbackRef = useRef<Playback | null>(null);
  const lastVersionRef = useRef(-1);
  const applyingRemoteRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);

  const [movie, setMovie] = useState<PartyMovie | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [hostUserId, setHostUserId] = useState<number | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [statuses, setStatuses] = useState<RoomStatus[]>([]);
  const [message, setMessage] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [connected, setConnected] = useState(false);
  const [ended, setEnded] = useState(false);
  const [error, setError] = useState("");
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [copied, setCopied] = useState(false);
  const recordView = useRecordMovieView(movie?.id ?? null, roomCode);

  const isHost = currentUserId != null && currentUserId === hostUserId;
  const timeline = useMemo(() => [
    ...messages.map((item) => ({ type: "message" as const, item })),
    ...statuses.map((item) => ({ type: "status" as const, item }))
  ].sort((a, b) => Date.parse(a.item.createdAt) - Date.parse(b.item.createdAt)), [messages, statuses]);

  function applyPlayback(update: Playback, force = false) {
    if (update.version < lastVersionRef.current) return;
    lastVersionRef.current = update.version;
    playbackRef.current = update;
    const video = videoRef.current;
    if (!video || video.readyState === 0) return;

    applyingRemoteRef.current = true;
    const target = Math.min(expectedPosition(update), Number.isFinite(video.duration) ? video.duration : Infinity);
    if (force || Math.abs(video.currentTime - target) > 0.75) video.currentTime = target;
    if (update.state === "PLAYING") {
      void video.play().then(() => setAutoplayBlocked(false)).catch(() => setAutoplayBlocked(true));
    } else {
      video.pause();
      setAutoplayBlocked(false);
    }
    window.setTimeout(() => { applyingRemoteRef.current = false; }, 150);
  }

  useEffect(() => {
    let active = true;
    let refreshingAuth = false;
    const socket = createWatchPartySocket();
    socketRef.current = socket;

    socket.on("connect", () => {
      if (!active) return;
      setConnected(true);
      setError("");
      socket.emit("party:join", { code: roomCode }, (ack: Ack) => {
        if (!ack.ok && active) setError(ack.message || "Could not join this party");
      });
    });
    socket.on("disconnect", () => active && setConnected(false));
    socket.on("connect_error", async (socketError) => {
      if (!active) return;
      setConnected(false);
      if (/auth|token/i.test(socketError.message) && !refreshingAuth) {
        refreshingAuth = true;
        try {
          const session = await apiFetch("/auth/me");
          if (active && session.ok) {
            setError("");
            socket.connect();
            return;
          }
        } finally {
          refreshingAuth = false;
        }
      }
      setError(socketError.message || "Could not connect to the watch party");
    });
    socket.on("party:snapshot", (snapshot: Snapshot) => {
      if (!active) return;
      setMovie(snapshot.movie);
      setCurrentUserId(snapshot.currentUserId);
      setHostUserId(snapshot.hostUserId);
      setMembers(snapshot.members);
      setMessages(snapshot.messages);
      playbackRef.current = snapshot.playback;
      lastVersionRef.current = snapshot.playback.version;
      window.setTimeout(() => applyPlayback(snapshot.playback, true), 0);
    });
    socket.on("playback:updated", (update: Playback) => {
      if (active) applyPlayback(update);
    });
    socket.on("presence:updated", ({ members: nextMembers }: { members: Member[] }) => {
      if (active) setMembers(nextMembers);
    });
    socket.on("host:changed", ({ hostUserId: nextHostId }: { hostUserId: number }) => {
      if (active) setHostUserId(nextHostId);
    });
    socket.on("chat:message", (nextMessage: ChatMessage) => {
      if (!active) return;
      setMessages((current) => current.some((item) => item.id === nextMessage.id)
        ? current
        : [...current, nextMessage].slice(-100));
    });
    socket.on("room:status", (status: RoomStatus) => {
      if (!active) return;
      setStatuses((current) => current.some((item) => item.id === status.id)
        ? current
        : [...current, status].slice(-100));
    });
    socket.on("party:ended", () => {
      if (!active) return;
      setEnded(true);
      setConnected(false);
      videoRef.current?.pause();
    });

    async function connect() {
      const preview = await apiFetch(`/watch-parties/${encodeURIComponent(roomCode)}`);
      if (!active) return;
      if (!preview.ok) {
        setError(await responseMessage(preview, preview.status === 401 ? "Sign in to join this party" : "Watch party not found"));
        return;
      }
      socket.connect();
    }
    void connect().catch(() => active && setError("Could not reach the watch party server"));

    return () => {
      active = false;
      socket.removeAllListeners();
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [roomCode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [timeline]);

  useEffect(() => {
    // A hidden tab may have its media paused or its timers suspended by the browser.
    // Catch the player up to the server clock when it becomes active again.
    function resumeVisiblePlayback() {
      if (document.visibilityState !== "visible" || !socketRef.current?.connected) return;
      const playback = playbackRef.current;
      if (playback) applyPlayback(playback, true);
    }

    document.addEventListener("visibilitychange", resumeVisiblePlayback);
    return () => document.removeEventListener("visibilitychange", resumeVisiblePlayback);
  }, []);

  useEffect(() => {
    const heartbeat = window.setInterval(() => {
      const video = videoRef.current;
      const socket = socketRef.current;
      if (isHost && document.visibilityState === "visible" && video && socket?.connected && !video.paused && !video.seeking) {
        socket.emit("playback:command", { action: "SYNC", position: video.currentTime });
      }
    }, 5_000);
    return () => window.clearInterval(heartbeat);
  }, [isHost]);

  function sendPlayback(action: "PLAY" | "PAUSE" | "SEEK") {
    const video = videoRef.current;
    // Browser-initiated media events in a background tab are not host commands.
    if (!isHost || !video || applyingRemoteRef.current || document.visibilityState !== "visible") return;
    socketRef.current?.emit("playback:command", { action, position: video.currentTime }, (ack: Ack) => {
      if (!ack.ok) setError(ack.message || "Playback update failed");
    });
  }

  function sendMessage(event: FormEvent) {
    event.preventDefault();
    const content = message.trim();
    if (!content || !socketRef.current?.connected) return;
    socketRef.current.emit("chat:send", { content }, (ack: Ack) => {
      if (ack.ok) setMessage((current) => current === message ? "" : current);
      else setError(ack.message || "Could not send message");
    });
  }

  function insertEmoji(emoji: string) {
    const input = messageInputRef.current;
    const start = input?.selectionStart ?? message.length;
    const end = input?.selectionEnd ?? message.length;
    const next = message.slice(0, start) + emoji + message.slice(end);
    if (next.length > 500) return;
    setMessage(next);
    setEmojiOpen(false);
    window.requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  }

  function transferHost(userId: number) {
    socketRef.current?.emit("host:transfer", { userId }, (ack: Ack) => {
      if (!ack.ok) setError(ack.message || "Could not transfer host rights");
    });
  }

  function leaveParty() {
    const socket = socketRef.current;
    if (!socket?.connected) {
      router.push("/watch-party");
      return;
    }
    socket.emit("party:leave", {}, () => router.push("/watch-party"));
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Could not copy the invite link");
    }
  }

  async function resumePlayback() {
    const playback = playbackRef.current;
    if (!playback || !videoRef.current) return;
    videoRef.current.currentTime = expectedPosition(playback);
    try {
      await videoRef.current.play();
      setAutoplayBlocked(false);
    } catch {
      setError("Your browser blocked playback. Check its media permissions.");
    }
  }

  if (ended) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#050407] px-5 text-white">
        <div className="max-w-md text-center">
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-white/5 text-2xl">■</div>
          <h1 className="mt-6 text-3xl font-semibold">This party has ended</h1>
          <p className="mt-3 text-sm leading-6 text-white/50">The host left and no other members were available to continue the room.</p>
          <Link href="/watch-party" className="mt-7 inline-flex rounded-xl bg-gradient-to-r from-[#7027e4] to-[#ee0a70] px-6 py-3 text-sm font-semibold">Start another party</Link>
        </div>
      </main>
    );
  }

  if (!movie && error) {
    return (
      <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_50%_0%,rgba(112,39,228,0.2),transparent_35%),#050407] px-5 text-white">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.035] p-8 text-center shadow-2xl">
          <Logo />
          <h1 className="mt-8 text-2xl font-semibold">Couldn&apos;t join this party</h1>
          <p className="mt-3 text-sm leading-6 text-white/50">{error}</p>
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <Link href="/" className="rounded-xl bg-gradient-to-r from-[#7027e4] to-[#ee0a70] px-4 py-3 text-sm font-semibold">Home / Sign in</Link>
            <button type="button" onClick={() => window.location.reload()} className="rounded-xl border border-white/10 px-4 py-3 text-sm text-white/70 transition hover:bg-white/5">Try again</button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_70%_-10%,rgba(112,39,228,0.2),transparent_30%),#050407] text-white">
      <header className="border-b border-white/[0.07] bg-black/20 px-5 backdrop-blur-xl sm:px-8">
        <div className="mx-auto flex h-20 max-w-[1500px] items-center gap-4">
          <Logo />
          <div className="ml-auto flex items-center gap-2">
            <InvitationBell />
            <span className={`hidden items-center gap-2 rounded-full border px-3 py-2 text-xs sm:flex ${connected ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" : "border-white/10 bg-white/5 text-white/40"}`}>
              <span className={`size-1.5 rounded-full ${connected ? "bg-emerald-400" : "bg-white/30"}`} />
              {connected ? "Live" : "Connecting"}
            </span>
            <button type="button" onClick={() => void copyInvite()} className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/70 transition hover:border-white/25 hover:text-white">{copied ? "Copied!" : "Copy invite"}</button>
            <button type="button" onClick={leaveParty} className="rounded-xl px-3 py-2 text-xs text-red-300/70 transition hover:bg-red-400/10 hover:text-red-200">Leave</button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] gap-5 px-4 py-5 sm:px-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0">
          <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black shadow-[0_30px_100px_rgba(0,0,0,0.5)]">
            {movie ? (
              <video
                ref={videoRef}
                src={movie.videoUrl}
                poster={movie.thumbnail || undefined}
                controls={isHost}
                playsInline
                preload="metadata"
                onLoadedMetadata={() => playbackRef.current && applyPlayback(playbackRef.current, true)}
                onPlay={() => sendPlayback("PLAY")}
                onPlaying={recordView}
                onPause={() => sendPlayback("PAUSE")}
                onSeeked={() => sendPlayback("SEEK")}
                className="h-full w-full bg-black object-contain"
              />
            ) : (
              <div className="grid h-full place-items-center"><div className="size-10 animate-spin rounded-full border-2 border-white/15 border-t-[#ee0a70]" /></div>
            )}
            {!isHost && movie && (
              <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-white/10 bg-black/60 px-3 py-1.5 text-[11px] text-white/60 backdrop-blur-md">Host controls playback</div>
            )}
            {autoplayBlocked && (
              <div className="absolute inset-0 grid place-items-center bg-black/65 backdrop-blur-sm">
                <button type="button" onClick={() => void resumePlayback()} className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-black shadow-xl">Enable playback</button>
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 sm:flex-row sm:items-center">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#ff6cae]">Now watching</p>
              <h1 className="mt-1 truncate text-xl font-semibold sm:text-2xl">{movie?.title || "Joining party…"}</h1>
            </div>
            <div className="sm:ml-auto sm:text-right">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Room code</p>
              <button onClick={() => void copyInvite()} className="mt-1 font-mono text-lg font-semibold tracking-[0.22em] text-white">{roomCode}</button>
            </div>
          </div>

          {isHost && <div className="mt-5 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5"><InviteUserForm code={roomCode} /></div>}

          {error && (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">
              <span>{error}</span>
              <button onClick={() => setError("")} className="shrink-0 text-red-100/60">Dismiss</button>
            </div>
          )}

          <section className="mt-5 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#a87cff]">In this room</p>
                <h2 className="mt-1 text-lg font-semibold">{members.length} online</h2>
              </div>
              {isHost && <span className="text-[11px] text-white/35">You can transfer host control</span>}
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {members.map((member) => (
                <div key={member.id} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-black/20 p-3">
                  <span className="relative grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#7027e4] to-[#ee0a70] text-xs font-semibold">
                    {member.username.charAt(0).toUpperCase()}
                    <span className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-[#0b0910] bg-emerald-400" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{member.name || member.username}{member.id === currentUserId ? " (you)" : ""}</p>
                    <p className={`mt-0.5 text-[10px] font-semibold uppercase tracking-wider ${member.id === hostUserId ? "text-[#ff6cae]" : "text-white/30"}`}>{member.id === hostUserId ? "Host" : "Member"}</p>
                  </div>
                  {isHost && member.id !== currentUserId && (
                    <button type="button" onClick={() => transferHost(member.id)} title={`Make ${member.username} host`} className="ml-auto rounded-lg border border-white/10 px-2 py-1.5 text-[10px] text-white/50 transition hover:border-[#ee0a70]/50 hover:text-white">Make host</button>
                  )}
                </div>
              ))}
            </div>
          </section>
        </section>

        <aside className="flex h-[620px] min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0d0a11] lg:sticky lg:top-5 lg:h-[calc(100vh-6.5rem)]">
          <div className="border-b border-white/[0.07] px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#ff6cae]">Live chat</p>
            <p className="mt-1 text-xs text-white/35">Messages and live room updates</p>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {timeline.length === 0 && <div className="grid h-full place-items-center text-center text-xs leading-5 text-white/30">No messages yet.<br />Say hello to the room.</div>}
            {timeline.map((entry) => {
              if (entry.type === "status") {
                const status = entry.item;
                return (
                  <div key={`status-${status.id}`} role="status" className="mx-auto flex w-fit max-w-full items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-center text-[11px] leading-4 text-white/50">
                    <span aria-hidden="true">{status.kind === "JOINED" ? "👋" : status.kind === "LEFT" ? "🚪" : "👑"}</span>
                    <span className="min-w-0 break-words">{roomStatusText(status)}</span>
                    <time className="shrink-0 text-white/25" dateTime={status.createdAt}>{formatClock(new Date(status.createdAt).getTime())}</time>
                  </div>
                );
              }
              const item = entry.item;
              const own = item.user.id === currentUserId;
              return (
                <div key={`message-${item.id}`} className={`flex gap-2.5 ${own ? "flex-row-reverse" : ""}`}>
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white/10 text-[10px] font-semibold">{item.user.username.charAt(0).toUpperCase()}</span>
                  <div className={`min-w-0 max-w-[80%] ${own ? "text-right" : ""}`}>
                    <p className="mb-1 px-1 text-[10px] text-white/35">{own ? "You" : item.user.name || item.user.username} · {formatClock(new Date(item.createdAt).getTime())}</p>
                    <p className={`break-words rounded-2xl px-3 py-2 text-left text-xs leading-5 ${own ? "rounded-tr-sm bg-gradient-to-br from-[#7027e4] to-[#b91684] text-white" : "rounded-tl-sm bg-white/[0.07] text-white/75"}`}>{item.content}</p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
          <form onSubmit={sendMessage} className="border-t border-white/[0.07] p-3">
            {emojiOpen && (
              <div id="room-emoji-picker" role="group" aria-label="Choose an emoji" className="mb-3 grid grid-cols-6 gap-1 rounded-xl border border-white/10 bg-[#17121d] p-2 sm:grid-cols-9">
                {CHAT_EMOJI.map((emoji) => (
                  <button key={emoji} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => insertEmoji(emoji)} aria-label={`Insert ${emoji}`} className="grid size-8 place-items-center rounded-lg text-lg transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee0a70]">{emoji}</button>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input ref={messageInputRef} value={message} onChange={(event) => setMessage(event.target.value.slice(0, 500))} disabled={!connected} placeholder="Message the room…" className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 text-xs text-white outline-none transition placeholder:text-white/25 focus:border-[#ee0a70]/60 disabled:opacity-40" />
              <button type="button" disabled={!connected} aria-label="Add emoji" aria-expanded={emojiOpen} aria-controls={emojiOpen ? "room-emoji-picker" : undefined} onClick={() => setEmojiOpen((open) => !open)} className="grid size-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-xl transition hover:border-[#ee0a70]/50 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee0a70] disabled:opacity-30">☺</button>
              <button disabled={!connected || !message.trim()} aria-label="Send message" className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#7027e4] to-[#ee0a70] text-sm transition hover:brightness-110 disabled:opacity-30">➤</button>
            </div>
            <p className="mt-2 px-1 text-right text-[9px] text-white/20">{message.length}/500</p>
          </form>
        </aside>
      </div>
    </main>
  );
}
