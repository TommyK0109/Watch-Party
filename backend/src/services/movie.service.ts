import { prisma } from "../lib/prisma";

export async function getMovies(options: { search?: string; genreId?: number; limit?: number } = {}) {
  const search = options.search?.trim();

  return prisma.movie.findMany({
    where: {
      ...(search ? { title: { contains: search, mode: "insensitive" as const } } : {}),
      ...(options.genreId ? { genreId: options.genreId } : {})
    },
    include: {
      genre: true
    },
    orderBy: search
      ? { title: "asc" }
      : { createdAt: "desc" },
    take: options.limit
  });
}

export async function getMovieById(id: number) {
  return prisma.movie.findUnique({
    where: { id },
    include: {
      genre: true,
      reviews: {
        include: {
          user: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }
    }
  });
}

export async function getMovieForWatch(id: number) {
  return prisma.movie.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      videoUrl: true,
      duration: true
    }
  });
}

export async function createMovie(data: {
  title: string;
  description?: string;
  thumbnail?: string;
  videoUrl: string;
  duration?: number;
  releaseYear?: number;
  genreId: number;
}) {
  return prisma.movie.create({
    data
  });
}

export async function updateMovie(
  id: number,
  data: {
    title?: string;
    description?: string;
    thumbnail?: string;
    videoUrl?: string;
    duration?: number;
    releaseYear?: number;
    genreId?: number;
  }
) {
  return prisma.movie.update({
    where: { id },
    data
  });
}

export async function deleteMovie(id: number) {
  return prisma.movie.delete({
    where: { id }
  });
}

export async function getMoviesByGenre(genreId: number, limit?: number) {
  return prisma.movie.findMany({
    where: { genreId },
    include: {
      genre: true
    },
    orderBy: {
      createdAt: "desc"
    },
    take: limit
  });
}

export async function getLatestMovies(limit = 20) {
  return prisma.movie.findMany({
    include: {
      genre: true
    },
    orderBy: {
      createdAt: "desc"
    },
    take: limit
  });
}

export async function getPopularMovies(limit = 20) {
  return prisma.movie.findMany({
    include: {
      genre: true
    },
    orderBy: [{ views: "desc" }, { id: "asc" }],
    take: limit
  });
}

export async function getGenres() {
  return prisma.genre.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" }
  });
}

export async function recordMovieView(movieId: number, sessionId: string) {
  const movie = await prisma.movie.findUnique({ where: { id: movieId }, select: { id: true } });
  if (!movie) return null;

  try {
    await prisma.$transaction([
      prisma.movieViewSession.create({ data: { movieId, sessionId } }),
      prisma.movie.update({ where: { id: movieId }, data: { views: { increment: 1 } } })
    ]);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return false;
    }
    throw error;
  }
}
