import { Router } from "express";

import {
  getMovies,
  getGenres,
  getPopularMovies,
  getMovieById,
  getMovieForWatch,
  recordMovieView,
  createMovie,
  updateMovie,
  deleteMovie
} from "../controllers/movie.controller";

import { requireAuth } from "../middlewares/auth.middleware";
import { requireAdmin } from "../middlewares/admin.middleware";

const router = Router();

// Public
router.get("/", getMovies);
router.get("/genres", getGenres);
router.get("/popular", getPopularMovies);
router.get("/:id", getMovieById);
router.get("/:id/watch", getMovieForWatch);
router.post("/:id/views", recordMovieView);

// Admin only
router.post(
  "/",
  requireAuth,
  requireAdmin,
  createMovie
);

router.patch(
  "/:id",
  requireAuth,
  requireAdmin,
  updateMovie
);

router.delete(
  "/:id",
  requireAuth,
  requireAdmin,
  deleteMovie
);

export default router;

