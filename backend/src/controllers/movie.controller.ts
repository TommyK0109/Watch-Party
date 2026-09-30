import { Request, Response } from "express";
import * as movieService from "../services/movie.service";

function requestedLimit(value: unknown, fallback: number) {
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : NaN;
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 50) : fallback;
}

export async function getPopularMovies(req: Request, res: Response) {
  try {
    const movies = await movieService.getPopularMovies(requestedLimit(req.query.limit, 12));
    res.json({ data: movies });
  } catch {
    res.status(500).json({ message: "Failed to get popular movies" });
  }
}

export async function recordMovieView(req: Request, res: Response) {
  const movieId = Number(req.params.id);
  const sessionId = req.body?.sessionId;
  if (!Number.isSafeInteger(movieId) || movieId <= 0 ||
      typeof sessionId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)) {
    return res.status(400).json({ message: "Invalid movie view" });
  }

  try {
    const counted = await movieService.recordMovieView(movieId, sessionId);
    if (counted === null) return res.status(404).json({ message: "Movie not found" });
    return res.status(counted ? 201 : 200).json({ counted });
  } catch {
    return res.status(500).json({ message: "Failed to record movie view" });
  }
}

export async function getMovies(
  req: Request,
  res: Response
) {
  try {
    const search = typeof req.query.search === "string"
      ? req.query.search.trim().slice(0, 100)
      : "";
    const requestedLimit = typeof req.query.limit === "string"
      ? Number.parseInt(req.query.limit, 10)
      : undefined;
    const limit = requestedLimit && Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 50)
      : undefined;
    const genreId = typeof req.query.genreId === "string"
      ? Number(req.query.genreId)
      : undefined;
    if (genreId !== undefined && (!Number.isSafeInteger(genreId) || genreId <= 0)) {
      return res.status(400).json({ message: "Invalid genre ID" });
    }

    const movies = await movieService.getMovies({ search, genreId, limit });

    res.json({
      data: movies
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to get movies"
    });
  }
}

export async function getMovieById(
  req: Request,
  res: Response
) {
  try {
    const id = Number(req.params.id);

    const movie = await movieService.getMovieById(id);

    if (!movie) {
      return res.status(404).json({
        message: "Movie not found"
      });
    }

    res.json(movie);
  } catch (error) {
    res.status(500).json({
      message: "Failed to get movie"
    });
  }
}

export async function getMovieForWatch(
  req: Request,
  res: Response
) {
  try {
    const id = Number(req.params.id);

    const movie = await movieService.getMovieForWatch(id);

    if (!movie) {
      return res.status(404).json({
        message: "Movie not found"
      });
    }

    res.json(movie);
  } catch (error) {
    res.status(500).json({
      message: "Failed to get movie"
    });
  }
}

export async function createMovie(
  req: Request,
  res: Response
) {
  try {
    const movie = await movieService.createMovie(req.body);

    res.status(201).json(movie);
  } catch (error) {
    res.status(500).json({
      message: "Failed to create movie"
    });
  }
}

export async function updateMovie(
  req: Request,
  res: Response
) {
  try {
    const id = Number(req.params.id);

    const movie = await movieService.updateMovie(
      id,
      req.body
    );

    res.json(movie);
  } catch (error) {
    res.status(500).json({
      message: "Failed to update movie"
    });
  }
}

export async function deleteMovie(
  req: Request,
  res: Response
) {
  try {
    const id = Number(req.params.id);

    await movieService.deleteMovie(id);

    res.status(204).send();
  } catch (error) {
    res.status(500).json({
      message: "Failed to delete movie"
    });
  }
}

export async function getGenres(_req: Request, res: Response) {
  try {
    const genres = await movieService.getGenres();
    res.json({ data: genres });
  } catch {
    res.status(500).json({ message: "Failed to get genres" });
  }
}
