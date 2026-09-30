"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import Logo from "@/components/Logo";
import { apiFetch, responseMessage } from "@/lib/api";
import { InvitationBell } from "./InvitationCenter";
import { roomCodeFromInput } from "./JoinPartyForm";

interface Movie {
  id: number;
  title: string;
  thumbnail: string | null;
  releaseYear: number | null;
  duration: number | null;
  genre: { name: string };
}

function formatDuration(seconds: number | null) {
  if (!seconds) return "Duration unavailable";
  const minutes = Math.round(seconds / 60);
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export default function WatchPartyLobby() {
  const router = useRouter();
  const [movies, setMovies] = useState<Movie[]>([]);
  const [selectedMovieId, setSelectedMovieId] = useState<number | null>(null);
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [needsAuth, setNeedsAuth] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [sessionResponse, movieResponse] = await Promise.all([
          apiFetch("/auth/me"),
          apiFetch("/movies")
        ]);
        if (!active) return;
        setNeedsAuth(!sessionResponse.ok);
        if (!movieResponse.ok) throw new Error(await responseMessage(movieResponse, "Could not load movies"));
        const body = await movieResponse.json() as { data: Movie[] };
        setMovies(body.data);
        setSelectedMovieId(body.data[0]?.id ?? null);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Could not load watch parties");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  async function createParty() {
    if (!selectedMovieId) return;
    setCreating(true);
    setError("");
    try {
      const response = await apiFetch("/watch-parties", {
        method: "POST",
        body: JSON.stringify({ movieId: selectedMovieId })
      });
      if (!response.ok) {
        if (response.status === 401) setNeedsAuth(true);
        throw new Error(await responseMessage(response, "Could not create the party"));
      }
      const party = await response.json() as { url: string };
      router.push(party.url);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create the party");
    } finally {
      setCreating(false);
    }
  }

  function joinParty(event: FormEvent) {
    event.preventDefault();
    const normalized = roomCodeFromInput(roomCode);
    if (!normalized) {
      setError("Enter a six-character code or room link");
      return;
    }
    router.push(`/watch-party/${normalized}`);
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_80%_0%,rgba(112,39,228,0.2),transparent_32%),radial-gradient(circle_at_5%_45%,rgba(238,10,112,0.14),transparent_28%),#050407] px-5 pb-16 text-white sm:px-8">
      <header className="mx-auto flex h-24 max-w-6xl items-center justify-between">
        <Logo />
        <div className="flex items-center gap-2">{!loading && !needsAuth && <InvitationBell />}<Link href="/" className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/70 transition hover:border-white/25 hover:text-white">Back home</Link></div>
      </header>

      <section className="mx-auto max-w-6xl pt-8">
        <div className="max-w-2xl">
          <span className="rounded-full border border-[#ee0a70]/30 bg-[#ee0a70]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#ff6cae]">Watch together</span>
          <h1 className="mt-5 text-4xl font-semibold tracking-[-0.05em] sm:text-6xl">Start a movie night, wherever everyone is.</h1>
          <p className="mt-5 max-w-xl text-sm leading-7 text-white/55 sm:text-base">Create a room, share its link, and keep playback, chat and everyone in sync.</p>
        </div>

        {needsAuth && (
          <div className="mt-8 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
            You need to sign in before creating or joining a party. <Link href="/" className="font-semibold underline">Sign in on the home page</Link>.
          </div>
        )}
        {error && <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">{error}</div>}

        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 sm:p-7">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a87cff]">Create a party</p>
                <h2 className="mt-2 text-2xl font-semibold">Choose a movie</h2>
              </div>
              <span className="text-xs text-white/35">{movies.length} available</span>
            </div>

            {loading ? (
              <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
                {[0, 1, 2].map((item) => <div key={item} className="aspect-[2/3] animate-pulse rounded-2xl bg-white/5" />)}
              </div>
            ) : movies.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-white/45">Add a movie in the database before creating a party.</div>
            ) : (
              <div className="mt-6 grid max-h-[560px] grid-cols-2 gap-4 overflow-y-auto pr-1 sm:grid-cols-3">
                {movies.map((movie) => {
                  const selected = movie.id === selectedMovieId;
                  return (
                    <button key={movie.id} type="button" onClick={() => setSelectedMovieId(movie.id)} className={`group overflow-hidden rounded-2xl border text-left transition ${selected ? "border-[#ee0a70] bg-[#ee0a70]/10 shadow-[0_0_0_3px_rgba(238,10,112,0.12)]" : "border-white/10 bg-black/20 hover:border-white/25"}`}>
                      <div className="relative aspect-[2/3] overflow-hidden bg-white/5">
                        {movie.thumbnail ? <Image src={movie.thumbnail} alt="" fill sizes="(max-width: 640px) 45vw, 200px" className="object-cover transition duration-500 group-hover:scale-105" unoptimized /> : <div className="grid h-full place-items-center text-3xl text-white/15">▶</div>}
                        {selected && <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-[#ee0a70] text-xs">✓</span>}
                      </div>
                      <div className="p-3">
                        <h3 className="truncate text-sm font-semibold">{movie.title}</h3>
                        <p className="mt-1 truncate text-[11px] text-white/40">{movie.releaseYear || "—"} · {movie.genre.name} · {formatDuration(movie.duration)}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <button type="button" disabled={needsAuth || !selectedMovieId || creating} onClick={() => void createParty()} className="mt-6 h-12 w-full rounded-xl bg-gradient-to-r from-[#7027e4] to-[#ee0a70] text-sm font-semibold shadow-[0_12px_36px_rgba(238,10,112,0.2)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">
              {creating ? "Creating room…" : "Create watch party"}
            </button>
          </section>

          <aside className="h-fit rounded-3xl border border-white/10 bg-[#0d0a11] p-6 sm:p-7">
            <div className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-[#7027e4]/30 to-[#ee0a70]/30 text-xl">⌁</div>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-[#ff6cae]">Have an invite?</p>
            <h2 className="mt-2 text-2xl font-semibold">Join with a code</h2>
            <p className="mt-3 text-sm leading-6 text-white/45">Paste a six-character code or the full room link.</p>
            <form onSubmit={joinParty} className="mt-6">
              <input value={roomCode} onChange={(event) => setRoomCode(event.target.value)} placeholder="Room code or link" aria-label="Room code or link" className="h-14 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-center text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#ee0a70]" />
              <button disabled={needsAuth || !roomCodeFromInput(roomCode)} className="mt-3 h-12 w-full rounded-xl border border-white/15 text-sm font-semibold text-white transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40">Join party</button>
            </form>
          </aside>
        </div>
      </section>
    </main>
  );
}
