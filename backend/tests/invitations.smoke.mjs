import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { io } from "socket.io-client";

const databaseUrl = new URL(process.env.DATABASE_URL);
assert.ok(["localhost", "127.0.0.1"].includes(databaseUrl.hostname), "The smoke test requires a local database");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl.toString() }) });
const baseUrl = process.env.WATCH_PARTY_TEST_URL || "http://localhost:3000";
const suffix = randomBytes(5).toString("hex");
const password = `Invite-${randomBytes(12).toString("hex")}!aA1`;
const userIds = [];
const sockets = [];
let partyCode;

async function post(path, cookie, body) {
  return fetch(`${baseUrl}/api${path}`, {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify(body || {})
  });
}

async function get(path, cookie) {
  return fetch(`${baseUrl}/api${path}`, { headers: { Cookie: cookie } });
}

function waitFor(socket, event, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, listener);
      reject(new Error(`Timed out waiting for ${event}`));
    }, 6000);
    function listener(value) {
      if (!predicate(value)) return;
      clearTimeout(timer);
      socket.off(event, listener);
      resolve(value);
    }
    socket.on(event, listener);
  });
}

async function connect(cookie) {
  const socket = io(baseUrl, { transports: ["websocket"], extraHeaders: { Cookie: cookie }, autoConnect: false, reconnection: false });
  sockets.push(socket);
  const connected = waitFor(socket, "connect");
  socket.connect();
  await connected;
  return socket;
}

async function emit(socket, event, payload) {
  return new Promise((resolve, reject) => {
    socket.timeout(6000).emit(event, payload, (error, ack) => error ? reject(error) : resolve(ack));
  });
}

async function makeUser(role) {
  const user = await prisma.user.create({
    data: {
      username: `invite_${role}_${suffix}`,
      email: `invite_${role}_${suffix}@example.test`,
      passwordHash: await bcrypt.hash(password, 10),
      emailVerifiedAt: new Date()
    }
  });
  userIds.push(user.id);
  return user;
}

async function login(email) {
  const response = await post("/auth/login", "", { email, password });
  assert.equal(response.status, 200, `Login failed: ${await response.text()}`);
  const cookie = response.headers.getSetCookie().find((value) => value.startsWith("accessToken="))?.split(";")[0];
  assert.ok(cookie, "Missing access cookie");
  return cookie;
}

try {
  const movie = await prisma.movie.findFirst({ where: { videoUrl: { not: "" } }, select: { id: true } });
  assert.ok(movie, "A playable movie is required");
  const host = await makeUser("host");
  const guest = await makeUser("guest");
  const expiringGuest = await makeUser("expiry");
  const hostCookie = await login(host.email);
  const guestCookie = await login(guest.email);
  const expiringCookie = await login(expiringGuest.email);

  const createdResponse = await post("/watch-parties", hostCookie, { movieId: movie.id });
  assert.equal(createdResponse.status, 201);
  partyCode = (await createdResponse.json()).code;
  const preview = await get(`/watch-parties/${partyCode}`, guestCookie);
  assert.equal(preview.status, 200);
  console.log(`Created room ${partyCode} and verified code lookup`);

  const hostSocket = await connect(hostCookie);
  const hostSnapshot = waitFor(hostSocket, "party:snapshot");
  assert.deepEqual(await emit(hostSocket, "party:join", { code: partyCode }), { ok: true });
  await hostSnapshot;
  const guestNotifications = await connect(guestCookie);
  const expiryNotifications = await connect(expiringCookie);

  const denied = await post(`/watch-parties/${partyCode}/invitations`, guestCookie, { identifier: expiringGuest.username });
  assert.equal(denied.status, 403);

  const guestEvent = waitFor(guestNotifications, "invitation:changed");
  const invitationResponse = await post(`/watch-parties/${partyCode}/invitations`, hostCookie, { identifier: guest.username });
  assert.equal(invitationResponse.status, 201);
  const invitation = await invitationResponse.json();
  await guestEvent;
  assert.equal(invitation.code, partyCode);
  assert.ok(Math.abs(new Date(invitation.expiresAt).getTime() - new Date(invitation.createdAt).getTime() - 300_000) < 2000);
  console.log("Host invited by username; recipient received a live notification");

  const dismissed = await post(`/watch-parties/invitations/${invitation.id}/dismiss`, guestCookie);
  assert.equal(dismissed.status, 200);
  const afterNo = await get("/watch-parties/invitations", guestCookie);
  const saved = (await afterNo.json()).data;
  assert.equal(saved.length, 1);
  assert.ok(saved[0].dismissedAt);
  console.log("No dismissed the popup while keeping the invitation in notifications");

  const accepted = await post(`/watch-parties/invitations/${invitation.id}/accept`, guestCookie);
  assert.equal(accepted.status, 200);
  assert.equal((await accepted.json()).url, `/watch-party/${partyCode}`);
  const guestSnapshot = waitFor(guestNotifications, "party:snapshot");
  assert.deepEqual(await emit(guestNotifications, "party:join", { code: partyCode }), { ok: true });
  assert.equal((await guestSnapshot).members.length, 2);
  assert.equal((await (await get("/watch-parties/invitations", guestCookie)).json()).data.length, 0);
  console.log("Saved invitation accepted and recipient joined the room");

  const expiryEvent = waitFor(expiryNotifications, "invitation:changed");
  const expiringResponse = await post(`/watch-parties/${partyCode}/invitations`, hostCookie, { identifier: expiringGuest.email });
  assert.equal(expiringResponse.status, 201);
  const expiringInvitation = await expiringResponse.json();
  await expiryEvent;
  await prisma.watchPartyInvitation.update({ where: { id: expiringInvitation.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  assert.equal((await (await get("/watch-parties/invitations", expiringCookie)).json()).data.length, 0);
  assert.equal(await prisma.watchPartyInvitation.count({ where: { id: expiringInvitation.id } }), 0);
  const expiredAccept = await post(`/watch-parties/invitations/${expiringInvitation.id}/accept`, expiringCookie);
  assert.equal(expiredAccept.status, 410);
  console.log("Email invitation expired and was deleted; expired acceptance was rejected");

  const pendingResponse = await post(`/watch-parties/${partyCode}/invitations`, hostCookie, { identifier: expiringGuest.username });
  assert.equal(pendingResponse.status, 201);
  assert.deepEqual(await emit(hostSocket, "party:leave", {}), { ok: true });
  assert.deepEqual(await emit(guestNotifications, "party:leave", {}), { ok: true });
  assert.equal(await prisma.watchPartyInvitation.count({ where: { party: { code: partyCode } } }), 0);
  console.log("Ending the room removed its pending invitations");
  console.log("PASS: invitation flow through the frontend origin");
} catch (error) {
  console.error("FAIL:", error);
  process.exitCode = 1;
} finally {
  for (const socket of sockets) socket.disconnect();
  if (partyCode) await prisma.watchParty.deleteMany({ where: { code: partyCode } });
  if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
  console.log("Removed disposable test accounts and room");
}
