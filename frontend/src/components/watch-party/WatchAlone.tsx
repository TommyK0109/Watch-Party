"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Logo from "@/components/Logo";
import { apiFetch, responseMessage } from "@/lib/api";
import { useRecordMovieView } from "@/lib/useRecordMovieView";

interface WatchMovie { id: number; title: string; videoUrl: string }

export default function WatchAlone({ movieId }: { movieId: string }) {
  const [movie, setMovie] = useState<WatchMovie | null>(null);
  const [error, setError] = useState("");
  const recordView = useRecordMovieView(movie?.id ?? null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await apiFetch(`/movies/${encodeURIComponent(movieId)}/watch`);
        if (!response.ok) throw new Error(await responseMessage(response, "Movie not found"));
        const result = await response.json() as WatchMovie;
        if (!result.videoUrl) throw new Error("This movie is not available to watch yet");
        if (active) setMovie(result);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Could not load movie");
      }
    }
    void load();
    return () => { active = false; };
  }, [movieId]);

  return (
    <main className="min-h-screen bg-[#050407] px-5 py-6 text-white sm:px-8">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4"><Logo /><Link href="/movies" className="text-sm text-white/60 hover:text-white">Back to movies</Link></header>
      <div className="mx-auto max-w-6xl pt-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#ff6cae]">Watching alone</p>
        <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">{movie?.title || "Loading movie…"}</h1>
        {error ? <p role="alert" className="mt-6 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">{error}</p> : (
          <div className="mt-6 aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black">
            {movie ? <video src={movie.videoUrl} controls playsInline preload="metadata" onPlaying={recordView} className="h-full w-full object-contain" /> : <div className="grid h-full place-items-center text-sm text-white/40">Loading player…</div>}
          </div>
        )}
      </div>
    </main>
  );
}
