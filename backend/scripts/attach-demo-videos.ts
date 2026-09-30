import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { prisma } from "../src/lib/prisma.ts";
import { RECOMMENDED_MOVIES, TRENDING_MOVIES } from "../../frontend/src/data/movies.ts";

const videoFiles = [
  "guardians.mp4",
  ...Array.from({ length: 22 }, (_, index) => `guardians${index + 1}.mp4`)
];

const movies = [...TRENDING_MOVIES, ...RECOMMENDED_MOVIES].filter(
  (movie, index, catalog) =>
    catalog.findIndex((item) => item.title.toLowerCase() === movie.title.toLowerCase()) === index
);

const primaryGenreByTitle: Record<string, string> = {
  "Guardians of the Galaxy Vol. 3": "Action",
  "Shazam! Fury of the Gods": "Action",
  "Dungeons & Dragons: Honor Among Thieves": "Fantasy",
  "Medellin": "Comedy",
  "John Wick: Chapter 4": "Action",
  "Spider-Man: Across the Spider-Verse": "Animation",
  "Tyler Perry's Sistas": "Drama",
  "The Cube": "Game Show",
  "Nancy Drew": "Mystery",
  "Rich in Love 2": "Romance",
  "The Black Demon": "Horror",
  "The Prank Panel": "Reality",
  "Hypnotic": "Thriller",
  "Mojave Diamonds": "Action",
  "Mojave": "Thriller",
  "Crossfire": "Action",
  "Fast X": "Action",
  "The Pregnancy Promise": "Thriller",
  "The Days": "Drama",
  "Days of Daisy": "Romance",
  "Turn of the Tide": "Crime",
  "The Idol": "Drama",
  "The Gryphon": "Fantasy"
};

async function main() {
  if (movies.length !== videoFiles.length) {
    throw new Error(`Expected one MP4 per movie: found ${movies.length} titles and ${videoFiles.length} files`);
  }
  if (movies.some((movie) => !primaryGenreByTitle[movie.title])) {
    throw new Error("Every catalog movie must have a primary genre");
  }

  for (const file of videoFiles) {
    await access(fileURLToPath(new URL(`../../frontend/public/videos/${file}`, import.meta.url)));
  }

  const existingMovies = await prisma.movie.findMany({
    select: { id: true, title: true, videoUrl: true, genreId: true }
  });
  const idsByTitle = new Map<string, (typeof existingMovies)[number]>();
  for (const movie of existingMovies) {
    const title = movie.title.trim().toLowerCase();
    if (idsByTitle.has(title)) throw new Error(`Duplicate database movie title: ${movie.title}`);
    idsByTitle.set(title, movie);
  }

  let created = 0;
  let updated = 0;
  await prisma.$transaction(async (tx) => {
    const genreIds = new Map<string, number>();
    for (const name of new Set(Object.values(primaryGenreByTitle))) {
      const genre = await tx.genre.upsert({ where: { name }, update: {}, create: { name } });
      genreIds.set(name, genre.id);
    }

    for (const [index, movie] of movies.entries()) {
      const videoUrl = `/videos/${videoFiles[index]}`;
      const genreId = genreIds.get(primaryGenreByTitle[movie.title])!;
      const existing = idsByTitle.get(movie.title.trim().toLowerCase());
      if (existing) {
        if (existing.videoUrl !== videoUrl || existing.genreId !== genreId) {
          await tx.movie.update({ where: { id: existing.id }, data: { videoUrl, genreId } });
          updated += 1;
        }
        continue;
      }

      await tx.movie.create({
        data: {
          title: movie.title,
          thumbnail: movie.image,
          videoUrl,
          releaseYear: movie.year ? Number(movie.year) : null,
          duration: movie.duration?.endsWith("m") ? Number(movie.duration.slice(0, -1)) * 60 : null,
          genreId
        }
      });
      created += 1;
    }

    const demoGenre = await tx.genre.findUnique({ where: { name: "Demo" }, select: { id: true } });
    if (demoGenre && await tx.movie.count({ where: { genreId: demoGenre.id } }) === 0) {
      await tx.genre.delete({ where: { id: demoGenre.id } });
    }
  }, { timeout: 30_000 });

  console.log(`Updated ${movies.length} catalog movies (${created} created, ${updated} updated).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
