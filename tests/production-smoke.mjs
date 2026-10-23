import assert from "node:assert/strict";
import fs from "node:fs";
const base = process.env.TEST_API;
if (!base?.startsWith("https://") || process.env.ALLOW_LIVE_TEST !== "1")
  throw Error(
    "Explicit TEST_API=https://.../api and ALLOW_LIVE_TEST=1 required",
  );
const checks = [],
  tokens = [];
let token = "",
  save;
async function call(path, method = "GET", body, auth = token) {
  const r = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + auth,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data;
  try {
    data = await r.json();
  } catch {
    throw Error("Non-JSON response: " + r.status);
  }
  return { status: r.status, body: data };
}
async function check(name, fn) {
  await fn();
  checks.push({ name, passed: true });
  console.log("PASS " + name);
}
async function command(
  command,
  id = crypto.randomUUID(),
  revision = save.revision,
) {
  const r = await call("/careers/" + save.id + "/commands", "POST", {
    id,
    revision,
    command,
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  save = r.body;
  return r;
}
try {
  await check("live health and disabled email verification", async () => {
    assert.equal((await call("/health")).body.ok, true);
    assert.equal((await call("/auth/config")).body.emailVerification, false);
  });
  await check("email registration and password login over HTTPS", async () => {
    const email = "release-smoke-" + Date.now() + "@example.test",
      password = crypto.randomUUID() + crypto.randomUUID();
    assert.equal(
      (await call("/auth/register", "POST", { email, password })).status,
      201,
    );
    const r = await call("/auth/login", "POST", { email, password });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    token = r.body.token;
    assert.ok(token);
    tokens.push(token);
  });
  await check("create career backed by production D1", async () => {
    const r = await call("/careers", "POST", {
      name: "Disposable release smoke",
      ceo: "Test CEO",
      city: "الرياض",
      legal: "llc",
      sector: 0,
      capital: 1000000,
      difficulty: "realistic",
    });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    save = r.body;
    assert.equal(save.state.cash, 100000000);
  });
  await check(
    "rent, equipment, hiring and authoritative balances",
    async () => {
      await command({ type: "rent" });
      await command({ type: "equip" });
      await command({ type: "hire", candidate: 0 });
      assert.equal(save.state.cash, 82600000);
    },
  );
  await check("idempotency survives network retries", async () => {
    const id = crypto.randomUUID(),
      revision = save.revision;
    await command({ type: "loan", amount: 100000 }, id, revision);
    const cash = save.state.cash;
    await command({ type: "loan", amount: 100000 }, id, revision);
    assert.equal(save.state.cash, cash);
  });
  await check("products, contracts and game time persist", async () => {
    await command({
      type: "develop",
      name: "Release-test product",
      price: 1000,
    });
    await command({ type: "contract" });
    await command({ type: "advance", minutes: 10080 });
    const persisted = await call("/careers/" + save.id);
    assert.deepEqual(persisted.body.state, save.state);
  });
  await check(
    "consistent snapshots and restore on production storage",
    async () => {
      await command({ type: "snapshot" });
      const expected = structuredClone(save.state);
      const points = (await call("/careers/" + save.id + "/snapshots")).body;
      assert.ok(points.length);
      await command({ type: "advance", minutes: 1440 });
      await command({ type: "restore", id: points[0].id });
      assert.deepEqual(save.state, expected);
    },
  );
  await check("cross-origin access restricted to frontend", async () => {
    const blocked = await fetch(base + "/health", {
      headers: { Origin: "https://untrusted.example" },
    });
    assert.equal(blocked.status, 403);
    const good = await fetch(base + "/health", {
      headers: { Origin: "https://marwanywr3-lab.github.io" },
    });
    assert.equal(
      good.headers.get("Access-Control-Allow-Origin"),
      "https://marwanywr3-lab.github.io",
    );
  });
  await check("anonymous access to saved career denied", async () =>
    assert.equal(
      (await call("/careers/" + save.id, "GET", undefined, "")).status,
      401,
    ),
  );
} finally {
  for (const auth of tokens) {
    const deleted = await call("/account", "DELETE", undefined, auth);
    assert.equal(deleted.status, 200, "Disposable account cleanup failed");
    assert.equal((await call("/careers", "GET", undefined, auth)).status, 401);
  }
}
fs.writeFileSync(
  "production-smoke-results.json",
  JSON.stringify(
    {
      date: new Date().toISOString(),
      target: base,
      checks,
      disposableAccountsDeleted: true,
    },
    null,
    2,
  ),
);
console.log(checks.length + " live checks passed; disposable data removed");
