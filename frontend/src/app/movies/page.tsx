import type { Metadata } from "next";
import MoviesPage from "@/components/MoviesPage";

export const metadata: Metadata = {
  title: "Movies — WatchParty",
  description: "Search and browse the WatchParty movie library."
};

interface MoviesRouteProps {
  searchParams: Promise<{ q?: string | string[]; genre?: string | string[]; browse?: string | string[] }>;
}

export default async function MoviesRoute({ searchParams }: MoviesRouteProps) {
  const params = await searchParams;
  const rawQuery = Array.isArray(params.q) ? params.q[0] : params.q;
  const rawGenre = Array.isArray(params.genre) ? params.genre[0] : params.genre;
  const rawBrowse = Array.isArray(params.browse) ? params.browse[0] : params.browse;
  const initialQuery = rawQuery?.trim().slice(0, 100) || "";
  const parsedGenre = rawGenre && /^\d+$/.test(rawGenre) ? Number(rawGenre) : null;
  const initialGenreId = parsedGenre && Number.isSafeInteger(parsedGenre) && parsedGenre > 0 ? parsedGenre : null;

  return <MoviesPage key={`${initialQuery}:${initialGenreId}:${rawBrowse}`} initialQuery={initialQuery} initialGenreId={initialGenreId} browseGenres={rawBrowse === "genres"} />;
}
