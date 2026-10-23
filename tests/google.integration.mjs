import assert from "node:assert/strict";
import fs from "node:fs";
const base = process.env.GOOGLE_TEST_API || "http://127.0.0.1:8792/api";
if (!base.startsWith("http://127.0.0.1:"))
  throw Error("Google integration checks are local-only");
const checks = [];
const request = async (path, body, token) => {
  const r = await fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, body: await r.json() };
};
const check = async (name, fn) => {
  await fn();
  checks.push({ name, passed: true });
  console.log("PASS", name);
};
let challenge, token;
const credentials = {
  email: "google-integration-" + Date.now() + "@example.test",
  password: "Google-test-only-password-2026",
};
await check(
  "Google is configured without requiring verification mail",
  async () => {
    const r = await request("/auth/config");
    assert.equal(r.status, 200);
    assert.ok(r.body.googleClientId.endsWith(".apps.googleusercontent.com"));
    assert.equal(r.body.emailVerification, false);
  },
);
await check("challenge returns unique random nonce and ID", async () => {
  const r = await request("/auth/google/challenge", {});
  assert.equal(r.status, 200);
  challenge = r.body;
  assert.notEqual(challenge.id, challenge.nonce);
  assert.match(challenge.id, /^[a-f0-9-]{36}$/);
});
await check("forged credentials fail signature verification", async () => {
  assert.equal(
    (
      await request("/auth/google", {
        credential: "forged",
        challenge: challenge.id,
      })
    ).status,
    401,
  );
});
await check("unknown challenges cannot be substituted", async () => {
  assert.equal(
    (
      await request("/auth/google", {
        credential: "forged",
        challenge: crypto.randomUUID(),
      })
    ).status,
    401,
  );
});
await check("account linking requires an authenticated session", async () => {
  assert.equal((await request("/account/google/challenge", {})).status, 401);
  await request("/auth/register", credentials);
  const r = await request("/auth/login", credentials);
  assert.equal(r.status, 200);
  token = r.body.token;
});
await check("linking nonce is bound to its authenticated account", async () => {
  const r = await request("/account/google/challenge", {}, token);
  assert.equal(r.status, 200);
  assert.ok(r.body.id.includes(":"));
  assert.equal(
    (
      await request(
        "/account/google/link",
        { credential: "forged", challenge: challenge.id },
        token,
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await request("/auth/google", {
        credential: "forged",
        challenge: r.body.id,
      })
    ).status,
    400,
  );
});
await check(
  "logout-all revokes every session for the current account",
  async () => {
    const second = (await request("/auth/login", credentials)).body.token;
    assert.ok(second);
    assert.equal((await request("/auth/logout-all", {}, token)).status, 200);
    assert.equal((await request("/account", undefined, second)).status, 401);
    assert.equal((await request("/account", undefined, token)).status, 401);
  },
);
fs.writeFileSync(
  "google-test-results.json",
  JSON.stringify(
    {
      date: new Date().toISOString(),
      target: base,
      checks,
      liveGoogleAccountLoginTested: false,
    },
    null,
    2,
  ) + "\n",
);
