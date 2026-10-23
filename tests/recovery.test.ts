import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
vi.mock("../apps/api/google", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../apps/api/google")>()),
  verifyGoogle: vi.fn(),
}));
import { verifyGoogle } from "../apps/api/google";
import worker from "../apps/api";
let db: DatabaseSync;
let env: Parameters<typeof worker.fetch>[1];
let oldToken: string;
const identity = { subject: "real-google-subject", email: "owner@gmail.com" };
async function request(path: string, data?: unknown, token?: string) {
  return worker.fetch(
    new Request("https://api.test/api" + path, {
      method: data === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    }),
    env,
  );
}
function prepared(sql: string, values: unknown[] = []): unknown {
  return {
    bind: (...args: unknown[]) => prepared(sql, args),
    first: async () => db.prepare(sql).get(...(values as [])) || null,
    all: async () => ({ results: db.prepare(sql).all(...(values as [])) }),
    run: async () => ({
      meta: { changes: Number(db.prepare(sql).run(...(values as [])).changes) },
    }),
    sql,
    values,
  };
}
beforeEach(async () => {
  db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  for (const name of [
    "0001_core.sql",
    "0002_google.sql",
    "0003_cleanup_indexes.sql",
  ])
    db.exec(fs.readFileSync("database/migrations/" + name, "utf8"));
  env = {
    GOOGLE_CLIENT_ID: "google-client",
    ALLOWED_ORIGIN: "https://game.test",
    DB: {
      prepare: prepared,
      batch: async (statements: { sql: string; values: unknown[] }[]) => {
        db.exec("BEGIN");
        try {
          const result = statements.map((x) => ({
            meta: {
              changes: Number(
                db.prepare(x.sql).run(...(x.values as [])).changes,
              ),
            },
          }));
          db.exec("COMMIT");
          return result;
        } catch (e) {
          db.exec("ROLLBACK");
          throw e;
        }
      },
    },
  } as unknown as typeof env;
  vi.mocked(verifyGoogle).mockReset();
  vi.mocked(verifyGoogle).mockResolvedValue(identity);
  await request("/auth/register", {
    email: identity.email,
    password: "Existing-Password-2026",
  });
  oldToken = (
    (await (
      await request("/auth/login", {
        email: identity.email,
        password: "Existing-Password-2026",
      })
    ).json()) as { token: string }
  ).token;
});
afterEach(() => db.close());
async function recover() {
  const challenge = (await (
    await request("/auth/google/recovery/challenge", {})
  ).json()) as { id: string; nonce: string };
  const response = await request("/auth/google/recovery", {
    challenge: challenge.id,
    credential: "signed-token-checked-by-provider-adapter",
  });
  return { challenge, response };
}
describe("explicit Google recovery with transactional SQL storage", () => {
  it("keeps the existing career, links subject, revokes old sessions and records recovery", async () => {
    const career = (await (
      await request(
        "/careers",
        {
          name: "Existing company",
          ceo: "Owner",
          city: "الرياض",
          legal: "llc",
          sector: 0,
          capital: 1000000,
          difficulty: "realistic",
        },
        oldToken,
      )
    ).json()) as { id: string };
    const { response, challenge } = await recover();
    expect(response.status).toBe(200);
    const token = ((await response.json()) as { token: string }).token;
    expect((await request("/careers", undefined, oldToken)).status).toBe(401);
    const careers = (await (
      await request("/careers", undefined, token)
    ).json()) as { id: string }[];
    expect(careers[0].id).toBe(career.id);
    expect(verifyGoogle).toHaveBeenCalledWith(
      "signed-token-checked-by-provider-adapter",
      "google-client",
      challenge.nonce,
    );
    expect(
      db
        .prepare(
          "SELECT COUNT(*) AS n FROM audit_logs WHERE action='google_account_recovery'",
        )
        .get()?.n,
    ).toBe(1);
    expect(
      db.prepare("SELECT subject FROM oauth_identities").get()?.subject,
    ).toBe(identity.subject);
  });
  it("never links a legacy account during regular Google sign-in", async () => {
    const c = (await (await request("/auth/google/challenge", {})).json()) as {
      id: string;
    };
    const r = await request("/auth/google", {
      challenge: c.id,
      credential: "verified-token",
    });
    expect(r.status).toBe(409);
    expect(
      db.prepare("SELECT COUNT(*) AS n FROM oauth_identities").get()?.n,
    ).toBe(0);
  });
  it("rejects third-party emails even if Google initially verified them", async () => {
    vi.mocked(verifyGoogle).mockResolvedValue({
      subject: "third-party",
      email: "owner@example.test",
    });
    expect((await recover()).response.status).toBe(403);
  });
  it("requires a purpose-bound recovery nonce and rejects replay", async () => {
    const regular = (await (
      await request("/auth/google/challenge", {})
    ).json()) as { id: string };
    expect(
      (
        await request("/auth/google/recovery", {
          challenge: regular.id,
          credential: "token",
        })
      ).status,
    ).toBe(400);
    const { challenge } = await recover();
    expect(
      (
        await request("/auth/google/recovery", {
          challenge: challenge.id,
          credential: "token",
        })
      ).status,
    ).toBe(401);
  });
  it("does not create a new account from a recovery-only request", async () => {
    vi.mocked(verifyGoogle).mockResolvedValue({
      subject: "missing-subject",
      email: "missing@gmail.com",
    });
    expect((await recover()).response.status).toBe(404);
    expect(db.prepare("SELECT COUNT(*) AS n FROM users").get()?.n).toBe(1);
  });
  it("cannot merge a subject already linked to a different account", async () => {
    db.prepare("INSERT INTO users VALUES(?,?,?,?,?)").run(
      "another-id",
      "another@gmail.com",
      "hash",
      "salt",
      Date.now(),
    );
    db.prepare("INSERT INTO oauth_identities VALUES(?,?,?)").run(
      "google",
      identity.subject,
      "another-id",
    );
    expect((await recover()).response.status).toBe(409);
    expect((await request("/careers", undefined, oldToken)).status).toBe(200);
  });
});
