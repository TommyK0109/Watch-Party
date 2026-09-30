"use client";

import { useEffect, useState } from "react";
import SiteHeader from "./SiteHeader";
import Hero from "./Hero";
import MovieRow from "./MovieRow";
import SignInModal from "./SignInModal";
import WatchPartySetupModal from "./watch-party/WatchPartySetupModal";
import { RECOMMENDED_MOVIES, TRENDING_MOVIES, type Movie } from "@/data/movies";
import { apiFetch } from "@/lib/api";
import { mergeMovieCatalog, type ApiMovie } from "@/lib/movies";

type AuthMode = "signin" | "signup";
interface SessionUser { username: string; email: string }
interface LibraryMovie { id: number; title: string }

export default function LandingPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [isAuthOpen, setAuthOpen] = useState(false);
  const [isAuthChecking, setAuthChecking] = useState(true);
  const [isSigningOut, setSigningOut] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [libraryMovies, setLibraryMovies] = useState<LibraryMovie[]>([]);
  const [popularMovies, setPopularMovies] = useState<ApiMovie[]>([]);

  useEffect(() => {
    let isActive = true;

    async function restoreSession() {
      try {
        const moviesRequest = apiFetch("/movies").catch(() => null);
        const popularRequest = apiFetch("/movies/popular?limit=12").catch(() => null);
        const response = await apiFetch("/auth/me");
        if (response.ok && isActive) setUser(await response.json() as SessionUser);
        const moviesResponse = await moviesRequest;
        if (moviesResponse?.ok && isActive) {
          const body = await moviesResponse.json() as { data: LibraryMovie[] };
          setLibraryMovies(body.data);
        }
        const popularResponse = await popularRequest;
        if (popularResponse?.ok && isActive) {
          const body = await popularResponse.json() as { data: ApiMovie[] };
          setPopularMovies(body.data);
        }
      } catch {
        if (isActive) setUser(null);
      } finally {
        if (isActive) setAuthChecking(false);
      }
    }

    void restoreSession();
    return () => { isActive = false; };
  }, []);

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

  function withDatabaseIds(movies: Movie[]) {
    const idsByTitle = new Map(libraryMovies.map((movie) => [movie.title.trim().toLowerCase(), movie.id]));
    return movies.map((movie) => ({ ...movie, id: idsByTitle.get(movie.title.trim().toLowerCase()) }));
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-white">
      <div className="pointer-events-none absolute right-[-12%] top-[-80px] h-[760px] w-[760px] rounded-full bg-[radial-gradient(circle,rgba(97,6,39,0.42),rgba(31,0,18,0.18)_48%,transparent_72%)]" />
      <div className="pointer-events-none absolute -left-24 top-[760px] size-60 rounded-full bg-[radial-gradient(circle,rgba(49,24,255,0.24),transparent_69%)]" />
      <SiteHeader
        username={user?.username || null}
        isAuthChecking={isAuthChecking}
        isSigningOut={isSigningOut}
        onSignIn={() => openAuth("signin")}
        onSignUp={() => openAuth("signup")}
        onSignOut={() => void signOut()}
      />
      <main className="relative">
        <Hero />
        <MovieRow id="trending" title="Trending" movies={popularMovies.length ? mergeMovieCatalog(popularMovies).slice(0, 12) : withDatabaseIds(TRENDING_MOVIES)} showFlame onSelectMovie={setSelectedMovie} />
        <MovieRow id="recommended" title="You may like this" movies={withDatabaseIds(RECOMMENDED_MOVIES)} onSelectMovie={setSelectedMovie} />
      </main>
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
