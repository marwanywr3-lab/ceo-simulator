import assert from "node:assert/strict";
import fs from "node:fs";
const base = process.env.TEST_API || "http://127.0.0.1:8787/api";
const results = [];
let token = "";
async function request(path, method = "GET", body, override = token) {
  const res = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + override,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}
async function check(name, fn) {
  await fn();
  results.push({ name, passed: true });
  console.log("PASS", name);
}
const email = "integration-" + Date.now() + "@example.test";
const password = "Test-only-strong-password-2026";
let save;
const id = crypto.randomUUID();
await check("email verification disabled and Google unconfigured", async () => {
  const r = await request("/auth/config");
  assert.equal(r.status, 200);
  assert.equal(r.body.emailVerification, false);
  assert.equal(r.body.googleClientId, null);
});
await check("Google login fails explicitly until configured", async () =>
  assert.equal(
    (
      await request("/auth/google", "POST", {
        credential: "forged",
        challenge: "fake",
      })
    ).status,
    503,
  ),
);
await check("anonymous career access denied", async () =>
  assert.equal((await request("/careers")).status, 401),
);
await check("account creation", async () =>
  assert.equal(
    (await request("/auth/register", "POST", { email, password })).status,
    201,
  ),
);
await check("login", async () => {
  const r = await request("/auth/login", "POST", { email, password });
  assert.equal(r.status, 200);
  assert.ok(r.body.token);
  token = r.body.token;
});
await check("company creation with capital only", async () => {
  const r = await request("/careers", "POST", {
    name: "Integration Co",
    ceo: "Test CEO",
    city: "الرياض",
    legal: "llc",
    capital: 1000000,
    sector: 0,
    difficulty: "realistic",
  });
  assert.equal(r.status, 201);
  save = r.body;
  assert.equal(save.state.cash, 100000000);
  assert.equal(save.state.employees.length, 0);
});
const cmd = async (
  command,
  commandId = crypto.randomUUID(),
  revision = save.revision,
) =>
  request("/careers/" + save.id + "/commands", "POST", {
    id: commandId,
    revision,
    command,
  });
await check(
  "server ignores forged cash and applies authoritative rent",
  async () => {
    const r = await cmd({ type: "rent", cash: 999999999999 }, id);
    assert.equal(r.status, 200);
    save = r.body;
    assert.equal(save.state.cash, 95500000);
  },
);
await check("idempotent replay does not double-spend", async () => {
  const r = await cmd({ type: "rent", cash: 999999999999 }, id, 0);
  assert.equal(r.status, 200);
  assert.equal(r.body.state.cash, 95500000);
  assert.equal(r.body.revision, 1);
});
await check("same id with changed payload rejected", async () =>
  assert.equal((await cmd({ type: "equip" }, id)).status, 409),
);
await check("stale revision rejected", async () =>
  assert.equal(
    (await cmd({ type: "equip" }, crypto.randomUUID(), 0)).status,
    409,
  ),
);
await check("unknown financial mutation blocked", async () =>
  assert.equal((await cmd({ type: "setCash", cash: 500 })).status, 400),
);
await check("equip, hire, rename and persistent memory", async () => {
  for (const c of [
    { type: "equip" },
    { type: "hire", candidate: 0 },
    { type: "meeting", agenda: "Protect cash flow" },
  ]) {
    const r = await cmd(c);
    assert.equal(r.status, 200);
    save = r.body;
  }
  const old = save.state.employees[0];
  const r = await cmd({ type: "rename", id: old.id, name: "Renamed CFO" });
  assert.equal(r.status, 200);
  save = r.body;
  assert.equal(save.state.employees[0].id, old.id);
  assert.equal(save.state.employees[0].salary, old.salary);
  assert.deepEqual(save.state.employees[0].memory, old.memory);
});
await check("snapshot restores complete consistent state", async () => {
  let r = await cmd({ type: "snapshot" });
  save = r.body;
  const before = structuredClone(save.state);
  const points = await request("/careers/" + save.id + "/snapshots");
  assert.equal(points.status, 200);
  r = await cmd({ type: "loan", amount: 100000 });
  save = r.body;
  r = await cmd({ type: "advance", minutes: 10080 });
  save = r.body;
  r = await cmd({ type: "restore", id: points.body[0].id });
  assert.equal(r.status, 200);
  save = r.body;
  assert.deepEqual(save.state, before);
});
await check(
  "concurrent commands commit at most once per revision",
  async () => {
    const rev = save.revision;
    const rs = await Promise.all([
      cmd({ type: "advance", minutes: 60 }, crypto.randomUUID(), rev),
      cmd({ type: "advance", minutes: 90 }, crypto.randomUUID(), rev),
    ]);
    assert.equal(rs.filter((r) => r.status === 200).length, 1);
    assert.equal(rs.filter((r) => r.status === 409).length, 1);
    save = (await request("/careers/" + save.id)).body;
  },
);
let other = "";
await check(
  "API command schema and authenticated account metadata",
  async () => {
    const schema = await request("/schema");
    assert.equal(schema.status, 200);
    assert.equal(schema.body.version, "0.3.0");
    const account = await request("/account");
    assert.equal(account.status, 200);
    assert.equal(account.body.account.email, email);
    assert.ok(!JSON.stringify(account.body).includes("password_hash"));
  },
);
await check(
  "training and supplier orders persist through real D1",
  async () => {
    for (const c of [
      { type: "train", id: save.state.employees[0].id, days: 2 },
      { type: "order", supplier: 1, quantity: 25 },
      { type: "lead", name: "API customer", budget: 10000 },
    ]) {
      const r = await cmd(c);
      assert.equal(r.status, 200);
      save = r.body;
    }
    const loaded = (await request("/careers/" + save.id)).body;
    assert.deepEqual(loaded.state.business, save.state.business);
    assert.equal(loaded.state.employees[0].trainingGain, 4);
  },
);
await check(
  "server-generated reports reconcile to the stored ledger",
  async () => {
    const r = await request("/careers/" + save.id + "/reports");
    assert.equal(r.status, 200);
    assert.equal(r.body.balanceSheet.balanced, true);
    assert.equal(r.body.cashFlow.closingCash, save.state.cash);
    assert.equal(
      (await request("/careers/" + save.id + "/reports?fromDay=-1")).status,
      400,
    );
  },
);
await check(
  "owned audit and save export use authoritative revision",
  async () => {
    const audit = await request("/careers/" + save.id + "/audit");
    assert.equal(audit.status, 200);
    assert.ok(audit.body.some((x) => x.action === "order"));
    const exported = await request("/careers/" + save.id + "/export");
    assert.equal(exported.status, 200);
    assert.equal(exported.body.revision, save.revision);
    assert.deepEqual(exported.body.state, save.state);
  },
);
await check(
  "new operational systems restore atomically with old systems",
  async () => {
    let r = await cmd({ type: "snapshot" });
    save = r.body;
    const before = structuredClone(save.state),
      points = (await request("/careers/" + save.id + "/snapshots")).body;
    r = await cmd({ type: "advance", minutes: 10080 });
    assert.equal(r.status, 200);
    save = r.body;
    assert.equal(save.state.business.orders[0].status, "delivered");
    r = await cmd({ type: "restore", id: points[0].id });
    assert.equal(r.status, 200);
    save = r.body;
    assert.deepEqual(save.state, before);
  },
);
await check(
  "concurrent identical retries apply once and both succeed",
  async () => {
    const revision = save.revision,
      commandId = crypto.randomUUID(),
      minute = save.state.minute;
    const results = await Promise.all([
      cmd({ type: "advance", minutes: 60 }, commandId, revision),
      cmd({ type: "advance", minutes: 60 }, commandId, revision),
    ]);
    assert.ok(results.every((r) => r.status === 200));
    save = (await request("/careers/" + save.id)).body;
    assert.equal(save.revision, revision + 1);
    assert.equal(save.state.minute, minute + 60);
  },
);
await check("second account and cross-user isolation", async () => {
  const second = "other-" + Date.now() + "@example.test";
  await request("/auth/register", "POST", { email: second, password });
  other = (await request("/auth/login", "POST", { email: second, password }))
    .body.token;
  assert.ok(other);
  assert.equal(
    (await request("/careers/" + save.id, "GET", undefined, other)).status,
    404,
  );
  assert.equal(
    (
      await request(
        "/careers/" + save.id + "/commands",
        "POST",
        {
          id: crypto.randomUUID(),
          revision: save.revision,
          command: { type: "advance", minutes: 1 },
        },
        other,
      )
    ).status,
    404,
  );
});
await check("CORS blocks unknown origins", async () => {
  const r = await fetch(base + "/health", {
    headers: { Origin: "https://untrusted.example" },
  });
  assert.equal(r.status, 403);
});
await check(
  "reports, audit and export remain isolated between users",
  async () => {
    for (const suffix of ["reports", "audit", "export"])
      assert.equal(
        (
          await request(
            "/careers/" + save.id + "/" + suffix,
            "GET",
            undefined,
            other,
          )
        ).status,
        404,
      );
  },
);
await check("oversized body rejected", async () => {
  const r = await request("/careers", "POST", { payload: "x".repeat(20000) });
  assert.equal(r.status, 413);
});
await check("state survives reload", async () =>
  assert.deepEqual(
    (await request("/careers/" + save.id)).body.state,
    save.state,
  ),
);
await check("account deletion cascades and invalidates session", async () => {
  assert.equal(
    (await request("/account", "DELETE", undefined, other)).status,
    200,
  );
  assert.equal(
    (await request("/careers", "GET", undefined, other)).status,
    401,
  );
});
await check("logout revokes token", async () => {
  assert.equal((await request("/auth/logout", "POST")).status, 200);
  assert.equal((await request("/careers")).status, 401);
});
await check("rate limit enforced", async () => {
  let status = 0;
  const testIp = "192.0.2." + ((Date.now() % 240) + 1);
  for (let i = 0; i < 13; i++) {
    const r = await fetch(base + "/auth/config", {
      headers: { "CF-Connecting-IP": testIp },
    });
    status = r.status;
  }
  assert.equal(status, 429);
});
fs.writeFileSync(
  "api-test-results.json",
  JSON.stringify(
    { date: new Date().toISOString(), target: base, tests: results },
    null,
    2,
  ),
);
console.log(`${results.length} integration checks passed`);
