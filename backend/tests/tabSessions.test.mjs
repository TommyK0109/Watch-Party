import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import { requireAuth } from "../src/middlewares/auth.middleware.ts";
import { signAccessToken } from "../src/lib/jwt.ts";
import { sessionCookieNames } from "../src/lib/tabSession.ts";

process.env.JWT_ACCESS_SECRET = "tab-session-test-secret";

const app = express();
app.use(cookieParser());
app.get("/me", requireAuth, (req, res) => res.json(req.user));

let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test("two tabs select different users from the same browser cookie jar", async () => {
  const firstTab = randomUUID();
  const secondTab = randomUUID();
  const cookie = [
    `${sessionCookieNames(firstTab).access}=${signAccessToken(101)}`,
    `${sessionCookieNames(secondTab).access}=${signAccessToken(202)}`
  ].join("; ");

  async function currentUser(tabId) {
    const response = await fetch(`${baseUrl}/me`, {
      headers: { Cookie: cookie, "X-Tab-Session": tabId }
    });
    assert.equal(response.status, 200);
    return response.json();
  }

  assert.deepEqual(await currentUser(firstTab), { id: 101 });
  assert.deepEqual(await currentUser(secondTab), { id: 202 });
  assert.deepEqual(await currentUser(firstTab), { id: 101 });

  const missingHeader = await fetch(`${baseUrl}/me`, { headers: { Cookie: cookie } });
  assert.equal(missingHeader.status, 401);
});

test("invalid tab IDs cannot select arbitrary cookie names", () => {
  assert.throws(() => sessionCookieNames("../../accessToken"), /Invalid tab session/);
});
