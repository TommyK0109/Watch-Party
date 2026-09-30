"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import MovieCard from "./MovieCard";
import SignInModal from "./SignInModal";
import SiteFooter from "./SiteFooter";
import SiteHeader from "./SiteHeader";
import WatchPartySetupModal from "./watch-party/WatchPartySetupModal";
import type { Movie } from "@/data/movies";
import { API_URL, apiFetch } from "@/lib/api";
import { mapDatabaseMovies, mergeMovieCatalog, searchMovies, type ApiMovie } from "@/lib/movies";

type AuthMode = "signin" | "signup";
interface SessionUser { username: string; email: string }

interface MoviesPageProps {
  initialQuery: string;
  initialGenreId: number | null;
  browseGenres: boolean;
}

interface Genre { id: number; name: string }

export default function MoviesPage({ initialQuery, initialGenreId, browseGenres }: MoviesPageProps) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [isAuthOpen, setAuthOpen] = useState(false);
  const [isAuthChecking, setAuthChecking] = useState(true);
  const [isSigningOut, setSigningOut] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [databaseMovies, setDatabaseMovies] = useState<ApiMovie[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [genresLoading, setGenresLoading] = useState(true);
  const [genresError, setGenresError] = useState(false);
  const genrePage = browseGenres || initialGenreId !== null;

  useEffect(() => {
    const controller = new AbortController();

    async function loadGenres() {
      try {
        const response = await fetch(`${API_URL}/movies/genres`, { signal: controller.signal });
        if (!response.ok) throw new Error("Genre request failed");
        const body = await response.json() as { data: Genre[] };
        if (!controller.signal.aborted) setGenres(body.data);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setGenresError(true);
      } finally {
        if (!controller.signal.aborted) setGenresLoading(false);
      }
    }

    void loadGenres();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    let isActive = true;

    async function restoreSession() {
      try {
        const response = await apiFetch("/auth/me");
        if (response.ok && isActive) setUser(await response.json() as SessionUser);
      } catch {
        if (isActive) setUser(null);
      } finally {
        if (isActive) setAuthChecking(false);
      }
    }

    void restoreSession();
    return () => { isActive = false; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    async function loadMovies() {
      setLoading(true);
      setLoadError(false);
      try {
        const params = new URLSearchParams();
        if (initialQuery) params.set("search", initialQuery);
        if (initialGenreId !== null) params.set("genreId", String(initialGenreId));
        const path = `${API_URL}/movies${params.size ? `?${params}` : ""}`;
        const response = await fetch(path, { signal: controller.signal });
        if (!response.ok) throw new Error("Movie request failed");
        const body = await response.json() as { data: ApiMovie[] };
        if (isActive) setDatabaseMovies(body.data);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError") && isActive) {
          setDatabaseMovies([]);
          setLoadError(true);
        }
      } finally {
        if (isActive) setLoading(false);
      }
    }

    void loadMovies();
    return () => {
      isActive = false;
      controller.abort();
    };
  }, [initialQuery, initialGenreId]);

  const movies = useMemo(
    () => searchMovies(initialGenreId !== null ? mapDatabaseMovies(databaseMovies) : mergeMovieCatalog(databaseMovies), initialQuery),
    [databaseMovies, initialQuery, initialGenreId]
  );
  const selectedGenre = genres.find((genre) => genre.id === initialGenreId);

  function openAuth(mode: AuthMode) {
    setAuthMode(mode);
    setAuthOpen(true);
  }

  async function signOut() {
    setSigningOut(true);
    try {
      await apiFetch("/auth/logout", { method: "POST" }, false);
    } finally {
      setUser(null);
      window.dispatchEvent(new Event("watchparty:auth-changed"));
      setSigningOut(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-white">
      <div className="pointer-events-none absolute right-[-12%] top-[-80px] h-[650px] w-[650px] rounded-full bg-[radial-gradient(circle,rgba(97,6,39,0.38),rgba(31,0,18,0.16)_48%,transparent_72%)]" />
      <div className="pointer-events-none absolute -left-24 top-[620px] size-60 rounded-full bg-[radial-gradient(circle,rgba(49,24,255,0.2),transparent_69%)]" />
      <SiteHeader
        username={user?.username || null}
        isAuthChecking={isAuthChecking}
        isSigningOut={isSigningOut}
        onSignIn={() => openAuth("signin")}
        onSignUp={() => openAuth("signup")}
        onSignOut={() => void signOut()}
        initialSearchQuery={initialQuery}
        genrePage={genrePage}
      />

      <main className="relative mx-auto min-h-[65vh] max-w-[1120px] px-5 pb-24 pt-12 sm:px-8 sm:pt-16 lg:px-12">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#ff6cae]">Movie library</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-7">
          <div>
            <h1 className="font-heading text-3xl tracking-[-0.035em] sm:text-5xl">
              {initialGenreId !== null
                ? <>{selectedGenre?.name || "Genre"} movies</>
                : browseGenres ? "Browse by genre"
                : initialQuery ? <>Results for <span className="text-white/55">“{initialQuery}”</span></> : "All movies"}
            </h1>
            {!isLoading && (
              <p className="mt-3 text-sm text-white/45">
                {movies.length} {movies.length === 1 ? "movie" : "movies"} found
              </p>
            )}
          </div>
        </div>

        <section className="mt-8" aria-labelledby="genres-heading">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="genres-heading" className="font-heading text-xl sm:text-2xl">Genres</h2>
            {initialGenreId !== null && <Link href="/movies?browse=genres" className="text-sm text-[#ff88bd] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee0a70]">View all genres</Link>}
          </div>
          {genresLoading ? (
            <p className="mt-4 text-sm text-white/45" role="status">Loading genres…</p>
          ) : genresError ? (
            <p className="mt-4 text-sm text-amber-100/75" role="alert">Genres could not be loaded. Please try again later.</p>
          ) : genres.length ? (
            <div className="mt-4 flex flex-wrap gap-2" aria-label="Filter movies by genre">
              {genres.map((genre) => (
                <Link
                  key={genre.id}
                  href={`/movies?genre=${genre.id}`}
                  aria-current={genre.id === initialGenreId ? "page" : undefined}
                  className={`rounded-full border px-4 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee0a70] ${genre.id === initialGenreId ? "border-[#ee0a70] bg-[#ee0a70]/20 text-white" : "border-white/15 bg-white/[0.04] text-white/70 hover:border-[#ee0a70]/60 hover:text-white"}`}
                >
                  {genre.name}
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-white/45">No genres are available yet.</p>
          )}
        </section>

        {loadError && initialGenreId !== null && (
          <p className="mt-6 rounded-xl border border-amber-400/15 bg-amber-400/[0.07] px-4 py-3 text-sm text-amber-100/75" role="alert">
            Movies for this genre could not be loaded. Please try again later.
          </p>
        )}

        {loadError && initialGenreId === null && movies.length > 0 && (
          <p className="mt-6 rounded-xl border border-amber-400/15 bg-amber-400/[0.07] px-4 py-3 text-xs text-amber-100/75">
            The movie service is unavailable, so these results are from the local catalog.
          </p>
        )}

        {isLoading ? (
          <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 sm:gap-x-5 md:grid-cols-4 lg:grid-cols-6 lg:gap-x-7" aria-label="Loading movies">
            {Array.from({ length: 12 }, (_, index) => (
              <div key={index} className="animate-pulse">
                <div className="aspect-[2/3] bg-white/[0.06]" />
                <div className="mt-3 h-3 w-4/5 rounded bg-white/[0.06]" />
                <div className="mt-3 h-2.5 w-1/2 rounded bg-white/[0.04]" />
              </div>
            ))}
          </div>
        ) : loadError && initialGenreId !== null ? null : movies.length ? (
          <section aria-label="Movie search results" className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 sm:gap-x-5 md:grid-cols-4 lg:grid-cols-6 lg:gap-x-7">
            {movies.map((movie) => (
              <MovieCard key={`${movie.id || "demo"}-${movie.title}`} movie={movie} onSelect={setSelectedMovie} />
            ))}
          </section>
        ) : (
          <div className="py-24 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-2xl text-white/35">⌕</span>
            <h2 className="mt-5 text-xl font-semibold">No movies found</h2>
            <p className="mt-2 text-sm text-white/45">{initialGenreId !== null ? "There are no movies in this genre yet." : "Try a different title or a shorter search."}</p>
          </div>
        )}
      </main>

      <SiteFooter />
      {isAuthOpen && (
        <SignInModal key={authMode} isOpen initialMode={authMode} onClose={() => setAuthOpen(false)} onSignedIn={setUser} />
      )}
      {selectedMovie && !isAuthOpen && (
        <WatchPartySetupModal
          movie={selectedMovie}
          isSignedIn={Boolean(user)}
          onClose={() => setSelectedMovie(null)}
          onRequireSignIn={() => {
            setSelectedMovie(null);
            openAuth("signin");
          }}
        />
      )}
    </div>
  );
}
