import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { test } from "node:test";
import { io as connectSocket } from "socket.io-client";
import app, { allowedOrigins } from "../src/app.ts";
import { signAccessToken } from "../src/lib/jwt.ts";
import { prisma } from "../src/lib/prisma.ts";
import { createParty } from "../src/services/watchParty.service.ts";

const databaseUrl = new URL(process.env.DATABASE_URL);
assert.ok(["localhost", "127.0.0.1"].includes(databaseUrl.hostname), "The smoke test requires a local database");
process.env.WATCH_PARTY_LEAVE_GRACE_MS = "50";
const { createSocketServer } = await import("../src/lib/socket.ts");

function waitFor(socket, event, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(event, listener);
      reject(new Error(`Timed out waiting for ${event}`));
    }, 5000);
    function listener(value) {
      if (!predicate(value)) return;
      clearTimeout(timeout);
      socket.off(event, listener);
      resolve(value);
    }
    socket.on(event, listener);
  });
}

function emit(socket, event, payload) {
  return new Promise((resolve, reject) => {
    socket.timeout(5000).emit(event, payload, (error, ack) => error ? reject(error) : resolve(ack));
  });
}

test("room status announces joins, departures, and host changes once per user", async () => {
  const suffix = randomUUID().slice(0, 8);
  const users = [];
  const sockets = [];
  let genre;
  let movie;
  let party;
  let ioServer;
  let httpServer;

  try {
    genre = await prisma.genre.create({ data: { name: `Room status ${suffix}` } });
    movie = await prisma.movie.create({ data: { title: `Room status ${suffix}`, videoUrl: "/videos/guardians.mp4", genreId: genre.id } });
    for (const label of ["host", "guest", "next"]) {
      users.push(await prisma.user.create({
        data: { username: `status_${label}_${suffix}`, email: `status_${label}_${suffix}@example.test`, passwordHash: "unused" }
      }));
    }
    const [host, guest, next] = users;
    party = await createParty(host.id, movie.id);
    httpServer = createServer(app);
    ioServer = createSocketServer(httpServer, allowedOrigins);
    await new Promise((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
    const baseUrl = `http://127.0.0.1:${httpServer.address().port}`;

    async function connect(user) {
      const socket = connectSocket(baseUrl, {
        transports: ["websocket"],
        extraHeaders: { Cookie: `accessToken=${signAccessToken(user.id)}` },
        autoConnect: false,
        reconnection: false
      });
      sockets.push(socket);
      const connected = waitFor(socket, "connect");
      socket.connect();
      await connected;
      return socket;
    }

    const hostSocket = await connect(host);
    const hostJoined = waitFor(hostSocket, "room:status", (event) => event.kind === "JOINED" && event.user.id === host.id);
    assert.deepEqual(await emit(hostSocket, "party:join", { code: party.code }), { ok: true });
    await hostJoined;

    const guestSocket = await connect(guest);
    const guestJoined = waitFor(hostSocket, "room:status", (event) => event.kind === "JOINED" && event.user.id === guest.id);
    assert.deepEqual(await emit(guestSocket, "party:join", { code: party.code }), { ok: true });
    await guestJoined;

    const guestSecondTab = await connect(guest);
    const unexpected = [];
    const collect = (event) => unexpected.push(event);
    hostSocket.on("room:status", collect);
    assert.deepEqual(await emit(guestSecondTab, "party:join", { code: party.code }), { ok: true });
    assert.deepEqual(await emit(guestSocket, "party:leave", {}), { ok: true });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(unexpected.length, 0, "A second tab and one-tab departure should not change user presence");
    hostSocket.off("room:status", collect);

    const guestLeft = waitFor(hostSocket, "room:status", (event) => event.kind === "LEFT" && event.user.id === guest.id);
    assert.deepEqual(await emit(guestSecondTab, "party:leave", {}), { ok: true });
    await guestLeft;

    const guestRejoined = waitFor(hostSocket, "room:status", (event) => event.kind === "JOINED" && event.user.id === guest.id);
    assert.deepEqual(await emit(guestSocket, "party:join", { code: party.code }), { ok: true });
    await guestRejoined;

    const transferred = waitFor(guestSocket, "room:status", (event) => event.kind === "HOST_TRANSFERRED");
    assert.deepEqual(await emit(hostSocket, "host:transfer", { userId: guest.id }), { ok: true });
    const transferStatus = await transferred;
    assert.deepEqual({ user: transferStatus.user.id, target: transferStatus.target.id }, { user: host.id, target: guest.id });

    const nextSocket = await connect(next);
    const nextJoined = waitFor(guestSocket, "room:status", (event) => event.kind === "JOINED" && event.user.id === next.id);
    assert.deepEqual(await emit(nextSocket, "party:join", { code: party.code }), { ok: true });
    await nextJoined;

    const formerHostLeft = waitFor(nextSocket, "room:status", (event) => event.kind === "LEFT" && event.user.id === host.id);
    assert.deepEqual(await emit(hostSocket, "party:leave", {}), { ok: true });
    await formerHostLeft;

    const guestDeparture = waitFor(nextSocket, "room:status", (event) => event.kind === "LEFT" && event.user.id === guest.id);
    const nextHost = waitFor(nextSocket, "room:status", (event) => event.kind === "HOST_ASSIGNED" && event.user.id === next.id);
    assert.deepEqual(await emit(guestSocket, "party:leave", {}), { ok: true });
    await guestDeparture;
    await nextHost;
    assert.deepEqual(await emit(nextSocket, "party:leave", {}), { ok: true });
  } finally {
    for (const socket of sockets) socket.disconnect();
    if (ioServer) await new Promise((resolve) => ioServer.close(resolve));
    if (httpServer?.listening) await new Promise((resolve) => httpServer.close(resolve));
    if (party) await prisma.watchParty.deleteMany({ where: { id: party.id } });
    if (movie) await prisma.movie.deleteMany({ where: { id: movie.id } });
    if (genre) await prisma.genre.deleteMany({ where: { id: genre.id } });
    if (users.length) await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });
    await prisma.$disconnect();
  }
});
