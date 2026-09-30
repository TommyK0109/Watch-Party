"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Movie } from "@/data/movies";
import { apiFetch, responseMessage } from "@/lib/api";
import JoinPartyForm from "./JoinPartyForm";
import InviteUserForm from "./InviteUserForm";

interface WatchPartySetupModalProps {
  movie: Movie;
  isSignedIn: boolean;
  onClose: () => void;
  onRequireSignIn: () => void;
}

interface CreatedParty {
  code: string;
  url: string;
}

export default function WatchPartySetupModal({ movie, isSignedIn, onClose, onRequireSignIn }: WatchPartySetupModalProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"choices" | "create" | "join">("choices");
  const [creating, setCreating] = useState(false);
  const [createdParty, setCreatedParty] = useState<CreatedParty | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  async function createParty() {
    if (!isSignedIn) return onRequireSignIn();
    if (!movie.id) return setError("This demo movie is not in the database yet.");
    setCreating(true);
    setError("");
    try {
      const response = await apiFetch("/watch-parties", {
        method: "POST",
        body: JSON.stringify({ movieId: movie.id })
      });
      if (!response.ok) throw new Error(await responseMessage(response, "Could not create the watch party"));
      setCreatedParty(await response.json() as CreatedParty);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create the watch party");
    } finally {
      setCreating(false);
    }
  }

  async function copyInvite() {
    if (!createdParty) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${createdParty.url}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Could not copy the invite link");
    }
  }

  function watchAlone() {
    if (!movie.id) return setError("This demo movie is not available to watch yet.");
    onClose();
    router.push(`/watch/${movie.id}`);
  }

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/75 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="movie-action-title" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="relative w-full max-w-[760px] overflow-hidden rounded-[28px] border border-white/10 bg-[#0d0a11] text-white shadow-[0_40px_120px_rgba(0,0,0,0.75)]">
        <button type="button" onClick={onClose} aria-label="Close movie options" className="absolute right-4 top-4 z-20 grid size-10 place-items-center rounded-full border border-white/10 bg-black/45 text-xl text-white/60 hover:text-white">×</button>
        <div className="grid md:grid-cols-[260px_1fr]">
          <div className="relative min-h-[220px] bg-white/5 md:min-h-[500px]">
            <Image src={movie.image} alt="" fill sizes="(max-width: 768px) 100vw, 260px" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0d0a11] via-transparent to-black/20 md:bg-gradient-to-r md:from-transparent md:to-[#0d0a11]/40" />
            <span className="absolute bottom-5 left-5 rounded-full border border-white/15 bg-black/55 px-3 py-1.5 text-[11px] text-white/75">{movie.year || "Movie"} · {movie.duration || "—"}</span>
          </div>
          <div className="flex min-h-[430px] flex-col justify-center p-6 sm:p-8">
            {!createdParty && mode === "choices" && (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#ff6cae]">Choose how to watch</p>
                <h2 id="movie-action-title" className="mt-3 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">{movie.title}</h2>
                <p className="mt-3 text-sm leading-6 text-white/50">Watch together in a synchronized room or play the movie on your own.</p>
                <div className="mt-7 space-y-3">
                  <button type="button" onClick={() => { setMode("create"); setError(""); }} className="w-full rounded-xl border border-[#ee0a70]/35 bg-[#ee0a70]/10 px-4 py-4 text-left text-sm font-semibold text-white transition hover:bg-[#ee0a70]/20">Create party <span className="mt-1 block text-xs font-normal text-white/45">Host a room and invite friends.</span></button>
                  <button type="button" onClick={() => { setMode("join"); setError(""); }} className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-4 text-left text-sm font-semibold text-white transition hover:bg-white/[0.08]">Join party <span className="mt-1 block text-xs font-normal text-white/45">Use a room code or invite link.</span></button>
                  <button type="button" onClick={watchAlone} className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-4 text-left text-sm font-semibold text-white transition hover:bg-white/[0.08]">Watch alone <span className="mt-1 block text-xs font-normal text-white/45">Play without a room.</span></button>
                </div>
                {!movie.id && <p className="mt-4 text-xs text-amber-200">This poster is demo content. Add the movie to the database to watch or host it.</p>}
              </>
            )}
            {!createdParty && mode === "join" && (
              <>
                <button onClick={() => setMode("choices")} className="self-start text-xs text-white/45 hover:text-white">← All options</button>
                <h2 id="movie-action-title" className="mt-4 text-2xl font-semibold">Join a party</h2>
                <p className="mt-2 text-sm leading-6 text-white/50">The room code determines which movie is playing.</p>
                <div className="mt-7"><JoinPartyForm isSignedIn={isSignedIn} onRequireSignIn={onRequireSignIn} onJoined={onClose} /></div>
              </>
            )}
            {!createdParty && mode === "create" && (
              <>
                <button onClick={() => setMode("choices")} className="self-start text-xs text-white/45 hover:text-white">← All options</button>
                <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#ff6cae]">Host a watch party</p>
                <h2 id="movie-action-title" className="mt-2 text-2xl font-semibold">Watch {movie.title} together</h2>
                <p className="mt-3 text-sm leading-6 text-white/50">Create a private room with synchronized playback and chat. You can share its link or invite a user directly.</p>
                {error && <p role="alert" className="mt-5 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-xs text-red-200">{error}</p>}
                <button type="button" onClick={() => void createParty()} disabled={creating || (isSignedIn && !movie.id)} className="mt-7 h-12 rounded-xl bg-gradient-to-r from-[#7027e4] to-[#ee0a70] text-sm font-semibold disabled:opacity-40">
                  {!isSignedIn ? "Sign in to create party" : creating ? "Creating room…" : "Create watch party"}
                </button>
              </>
            )}
            {createdParty && (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-300">Room ready</p>
                <h2 id="movie-action-title" className="mt-2 text-2xl font-semibold">Invite your friends</h2>
                <button type="button" onClick={() => void copyInvite()} className="mt-5 self-start rounded-xl border border-white/15 bg-black/25 px-5 py-3 font-mono text-xl font-semibold tracking-[0.25em]">{createdParty.code}</button>
                <p className="mt-2 text-xs text-white/40">{copied ? "Link copied" : "Click the code to copy the room link"}</p>
                <div className="mt-6"><InviteUserForm code={createdParty.code} /></div>
                {error && <p role="alert" className="mt-4 text-xs text-red-300">{error}</p>}
                <button type="button" onClick={() => router.push(createdParty.url)} className="mt-6 h-12 rounded-xl bg-gradient-to-r from-[#7027e4] to-[#ee0a70] text-sm font-semibold">Enter party room</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
