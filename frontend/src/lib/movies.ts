import {
  RECOMMENDED_MOVIES,
  TRENDING_MOVIES,
  type Movie
} from "@/data/movies";

export interface ApiMovie {
  id: number;
  title: string;
  thumbnail?: string | null;
  releaseYear?: number | null;
  duration?: number | null;
}

export const DEMO_MOVIES = uniqueMovies([
  ...TRENDING_MOVIES,
  ...RECOMMENDED_MOVIES
]);

function normalizedTitle(title: string) {
  return title.trim().toLocaleLowerCase();
}

function uniqueMovies(movies: Movie[]) {
  const seen = new Set<string>();
  return movies.filter((movie) => {
    const title = normalizedTitle(movie.title);
    if (seen.has(title)) return false;
    seen.add(title);
    return true;
  });
}

function displayDuration(seconds?: number | null) {
  if (!seconds) return undefined;
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const remainder = totalMinutes % 60;
  return hours ? `${hours}h ${remainder}m` : `${remainder}m`;
}

export function mapDatabaseMovies(apiMovies: ApiMovie[]) {
  const demosByTitle = new Map(
    DEMO_MOVIES.map((movie) => [normalizedTitle(movie.title), movie])
  );
  return apiMovies.map<Movie>((movie) => {
    const demo = demosByTitle.get(normalizedTitle(movie.title));
    const localThumbnail = movie.thumbnail?.startsWith("/")
      ? movie.thumbnail
      : undefined;

    return {
      id: movie.id,
      title: movie.title,
      image: localThumbnail || demo?.image || "/movies/poster-19.png",
      year: movie.releaseYear?.toString() || demo?.year,
      duration: displayDuration(movie.duration) || demo?.duration
    };
  });
}

export function mergeMovieCatalog(apiMovies: ApiMovie[]) {
  const databaseMovies = mapDatabaseMovies(apiMovies);

  return uniqueMovies([
    ...databaseMovies,
    ...DEMO_MOVIES.filter(
      (movie) => !databaseMovies.some(
        (databaseMovie) => normalizedTitle(databaseMovie.title) === normalizedTitle(movie.title)
      )
    )
  ]);
}

export function searchMovies(movies: Movie[], query: string) {
  const normalizedQuery = normalizedTitle(query);
  if (!normalizedQuery) return movies;

  return movies
    .map((movie, index) => {
      const title = normalizedTitle(movie.title);
      const wordPrefix = title.split(/[^a-z0-9]+/i).some((word) => word.startsWith(normalizedQuery));
      const rank = title.startsWith(normalizedQuery) ? 0 : wordPrefix ? 1 : 2;
      return { movie, index, rank, matches: title.includes(normalizedQuery) };
    })
    .filter((item) => item.matches)
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .map((item) => item.movie);
}
