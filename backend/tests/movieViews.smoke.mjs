import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import "dotenv/config";
import app from "../src/app.ts";
import { prisma } from "../src/lib/prisma.ts";

test("a viewing session counts once and affects popular movies", async () => {
  const genre = await prisma.genre.create({ data: { name: `View test ${randomUUID()}` } });
  const movie = await prisma.movie.create({
    data: { title: `View test ${randomUUID()}`, videoUrl: "/videos/guardians.mp4", genreId: genre.id }
  });
  const server = app.listen(0);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const sessionId = randomUUID();
    const endpoint = `${baseUrl}/api/movies/${movie.id}/views`;
    const record = (id) => fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: id })
    });

    const first = await record(sessionId);
    assert.equal(first.status, 201);
    assert.deepEqual(await first.json(), { counted: true });

    const repeated = await record(sessionId);
    assert.equal(repeated.status, 200);
    assert.deepEqual(await repeated.json(), { counted: false });

    const secondViewer = await record(randomUUID());
    assert.equal(secondViewer.status, 201);

    const movieResponse = await fetch(`${baseUrl}/api/movies/${movie.id}`);
    assert.equal((await movieResponse.json()).views, 2);

    const popularResponse = await fetch(`${baseUrl}/api/movies/popular?limit=50`);
    const popular = (await popularResponse.json()).data;
    assert.equal(popular.find((item) => item.id === movie.id)?.views, 2);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await prisma.movie.delete({ where: { id: movie.id } });
    await prisma.genre.delete({ where: { id: genre.id } });
    await prisma.$disconnect();
  }
});
