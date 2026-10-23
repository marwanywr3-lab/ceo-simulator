import { verifyGoogle } from "./google";
import { equalSecret, readLimitedBody, PayloadTooLarge } from "./security";
import { careerInput, credentials, commandInput } from "../../packages/shared";
import {
  createState,
  execute,
  RuleError,
  type State,
} from "../../packages/simulation";
type Env = CloudflareBindings & {
  GOOGLE_CLIENT_ID?: string;
};
type Row = {
  id: string;
  user_id: string;
  name: string;
  state: string;
  revision: number;
};
const json = (data: unknown, status = 200) => Response.json(data, { status });
const bytes = (s: string) => new TextEncoder().encode(s);
async function hash(value: string) {
  return [
    ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes(value))),
  ]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
async function password(value: string, salt: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    bytes(value),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: bytes(salt), iterations: 100000, hash: "SHA-256" },
    key,
    256,
  );
  return [...new Uint8Array(bits)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
const view = (r: Row) => ({
  id: r.id,
  name: r.name,
  revision: r.revision,
  state: JSON.parse(r.state) as State,
});
async function route(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url),
    path = url.pathname,
    now = Date.now();
  if (path === "/api/health")
    return json({
      ok: true,
      storage: "D1",
      ai: {
        enabled: false,
        reason: "Provider credentials and verified model IDs required",
      },
    });
  const ip = req.headers.get("CF-Connecting-IP") || "local";
  const bucket = await hash(
    ip +
      ":" +
      (path.startsWith("/api/auth") ? "auth" : "api") +
      ":" +
      Math.floor(now / 60000),
  );
  const limit = path.startsWith("/api/auth") ? 12 : 120;
  const rate = await env.DB.prepare(
    "INSERT INTO rate_limits(bucket,count,expires_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1 RETURNING count",
  )
    .bind(bucket, now + 120000)
    .first<{ count: number }>();
  if (rate && rate.count > limit)
    return json({ error: "Too many requests / طلبات كثيرة" }, 429);
  if (Math.random() < 0.02)
    await env.DB.prepare("DELETE FROM rate_limits WHERE expires_at<?")
      .bind(now)
      .run();
  if (path === "/api/auth/config" && req.method === "GET")
    return json({
      googleClientId: env.GOOGLE_CLIENT_ID || null,
      emailVerification: false,
    });
  if (path === "/api/auth/google/challenge" && req.method === "POST") {
    if (!env.GOOGLE_CLIENT_ID)
      return json({ error: "Google sign-in is not configured" }, 503);
    const id = crypto.randomUUID(),
      nonce = crypto.randomUUID();
    await env.DB.prepare("DELETE FROM auth_challenges WHERE expires_at<?")
      .bind(now)
      .run();
    await env.DB.prepare("INSERT INTO auth_challenges VALUES(?,?,?)")
      .bind(id, nonce, now + 300000)
      .run();
    return json({ id, nonce });
  }
  if (path === "/api/auth/google" && req.method === "POST") {
    if (!env.GOOGLE_CLIENT_ID)
      return json({ error: "Google sign-in is not configured" }, 503);
    const input = (await req.json()) as {
      credential?: string;
      challenge?: string;
    };
    if (
      typeof input.credential !== "string" ||
      input.credential.length > 12000 ||
      typeof input.challenge !== "string"
    )
      return json({ error: "Invalid Google response" }, 400);
    const challenge = await env.DB.prepare(
      "SELECT nonce FROM auth_challenges WHERE id=? AND expires_at>?",
    )
      .bind(input.challenge, now)
      .first<{ nonce: string }>();
    if (!challenge) return json({ error: "Google challenge expired" }, 401);
    let identity;
    try {
      identity = await verifyGoogle(
        input.credential,
        env.GOOGLE_CLIENT_ID,
        challenge.nonce,
      );
    } catch {
      return json({ error: "Google sign-in failed" }, 401);
    }
    const used = await env.DB.prepare(
      "DELETE FROM auth_challenges WHERE id=? RETURNING id",
    )
      .bind(input.challenge)
      .first();
    if (!used) return json({ error: "Google challenge already used" }, 401);
    let linked = await env.DB.prepare(
      "SELECT user_id FROM oauth_identities WHERE provider=? AND subject=?",
    )
      .bind("google", identity.subject)
      .first<{ user_id: string }>();
    if (!linked) {
      const existing = await env.DB.prepare(
        "SELECT id FROM users WHERE email=?",
      )
        .bind(identity.email)
        .first();
      if (existing)
        return json(
          {
            error:
              "Use your existing email/password account. Automatic account linking is disabled.",
          },
          409,
        );
      const uid = crypto.randomUUID();
      await env.DB.batch([
        env.DB.prepare("INSERT INTO users VALUES(?,?,?,?,?)").bind(
          uid,
          identity.email,
          await hash(crypto.randomUUID()),
          crypto.randomUUID(),
          now,
        ),
        env.DB.prepare("INSERT INTO oauth_identities VALUES(?,?,?)").bind(
          "google",
          identity.subject,
          uid,
        ),
      ]);
      linked = { user_id: uid };
    }
    const token = crypto.randomUUID() + crypto.randomUUID();
    await env.DB.prepare("INSERT INTO auth_sessions VALUES(?,?,?)")
      .bind(await hash(token), linked.user_id, now + 86400000)
      .run();
    return json({ token });
  }
  if (
    req.method === "POST" &&
    ["/api/auth/register", "/api/auth/login"].includes(path)
  ) {
    const input = credentials.parse(await req.json());
    const email = input.email.toLowerCase();
    if (path.endsWith("register")) {
      const salt = crypto.randomUUID();
      const digest = await password(input.password, salt);
      await env.DB.prepare("INSERT OR IGNORE INTO users VALUES(?,?,?,?,?)")
        .bind(crypto.randomUUID(), email, digest, salt, now)
        .run();
      return json(
        { message: "يمكنك محاولة تسجيل الدخول / You may now try signing in" },
        201,
      );
    }
    const user = await env.DB.prepare("SELECT * FROM users WHERE email=?")
      .bind(email)
      .first<{ id: string; salt: string; password_hash: string }>();
    const digest = await password(
      input.password,
      user?.salt || "dummy-timing-salt",
    );
    const passwordMatches = await equalSecret(
      digest,
      user?.password_hash || "0".repeat(64),
    );
    if (!user || !passwordMatches)
      return json(
        { error: "بيانات الدخول غير صحيحة / Invalid credentials" },
        401,
      );
    const token = crypto.randomUUID() + crypto.randomUUID();
    await env.DB.prepare("INSERT INTO auth_sessions VALUES(?,?,?)")
      .bind(await hash(token), user.id, now + 86400000)
      .run();
    return json({ token });
  }
  const auth = req.headers.get("Authorization");
  const tokenHash = await hash(
    auth?.startsWith("Bearer ") ? auth.slice(7) : "",
  );
  const session = await env.DB.prepare(
    "SELECT user_id FROM auth_sessions WHERE token_hash=? AND expires_at>?",
  )
    .bind(tokenHash, now)
    .first<{ user_id: string }>();
  if (!session) return json({ error: "سجّل الدخول / Sign in required" }, 401);
  const uid = session.user_id;
  if (path === "/api/auth/logout" && req.method === "POST") {
    await env.DB.prepare("DELETE FROM auth_sessions WHERE token_hash=?")
      .bind(tokenHash)
      .run();
    return json({ ok: true });
  }
  if (path === "/api/account" && req.method === "DELETE") {
    await env.DB.prepare("DELETE FROM users WHERE id=?").bind(uid).run();
    return json({ ok: true });
  }
  if (path === "/api/careers") {
    if (req.method === "GET") {
      const rows = await env.DB.prepare(
        "SELECT id,name,revision FROM careers WHERE user_id=? ORDER BY created_at DESC",
      )
        .bind(uid)
        .all();
      return json(rows.results);
    }
    if (req.method === "POST") {
      const input = careerInput.parse(await req.json());
      const id = crypto.randomUUID();
      const state = createState(input);
      await env.DB.prepare(
        "INSERT INTO careers(id,user_id,name,state,created_at) VALUES(?,?,?,?,?)",
      )
        .bind(id, uid, input.name, JSON.stringify(state), now)
        .run();
      return json({ id, name: input.name, state, revision: 0 }, 201);
    }
  }
  const match = path.match(
    /^\/api\/careers\/([^/]+)(?:\/(commands|snapshots))?$/,
  );
  if (match) {
    const id = match[1];
    const row = await env.DB.prepare(
      "SELECT * FROM careers WHERE id=? AND user_id=?",
    )
      .bind(id, uid)
      .first<Row>();
    if (!row) return json({ error: "Not found" }, 404);
    if (!match[2] && req.method === "GET") return json(view(row));
    if (match[2] === "snapshots" && req.method === "GET") {
      return json(
        (
          await env.DB.prepare(
            "SELECT id,revision,created_at FROM save_snapshots WHERE career_id=? ORDER BY created_at DESC LIMIT 30",
          )
            .bind(id)
            .all()
        ).results,
      );
    }
    if (match[2] === "commands" && req.method === "POST") {
      const body = (await req.json()) as {
        id?: string;
        revision?: number;
        command?: unknown;
      };
      if (
        !body.id ||
        !/^[a-zA-Z0-9-]{8,80}$/.test(body.id) ||
        !Number.isSafeInteger(body.revision)
      )
        return json({ error: "Invalid command envelope" }, 400);
      const command = commandInput.parse(body.command);
      const payload = JSON.stringify(command);
      const prior = await env.DB.prepare(
        "SELECT payload FROM processed_commands WHERE career_id=? AND command_id=?",
      )
        .bind(id, body.id)
        .first<{ payload: string }>();
      if (prior) {
        if (prior.payload !== payload)
          return json(
            { error: "Idempotency key reused with different command" },
            409,
          );
        const latest = await env.DB.prepare(
          "SELECT * FROM careers WHERE id=? AND user_id=?",
        )
          .bind(id, uid)
          .first<Row>();
        return json(view(latest!));
      }
      if (body.revision !== row.revision)
        return json(
          { error: "تغيّرت الحالة؛ أعد التحميل / State conflict; reload" },
          409,
        );
      let next: State;
      let snapshot = false;
      if (command.type === "snapshot") {
        next = JSON.parse(row.state);
        snapshot = true;
      } else if (command.type === "restore") {
        const saved = await env.DB.prepare(
          "SELECT state FROM save_snapshots WHERE id=? AND career_id=?",
        )
          .bind(command.id, id)
          .first<{ state: string }>();
        if (!saved) return json({ error: "Snapshot missing" }, 404);
        next = JSON.parse(saved.state);
        snapshot = true;
      } else next = execute(JSON.parse(row.state), command);
      const revision = row.revision + 1;
      const attempt = crypto.randomUUID();
      const batch = [
        env.DB.prepare(
          "UPDATE careers SET state=?,revision=?,last_command=? WHERE id=? AND user_id=? AND revision=?",
        ).bind(JSON.stringify(next), revision, attempt, id, uid, row.revision),
        env.DB.prepare(
          "INSERT INTO processed_commands SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM careers WHERE id=? AND revision=? AND last_command=?)",
        ).bind(id, body.id, payload, revision, id, revision, attempt),
        env.DB.prepare(
          "INSERT INTO audit_logs SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM careers WHERE id=? AND revision=? AND last_command=?)",
        ).bind(
          crypto.randomUUID(),
          uid,
          id,
          command.type,
          now,
          id,
          revision,
          attempt,
        ),
      ];
      if (snapshot || ["loan", "fire", "branch"].includes(command.type))
        batch.push(
          env.DB.prepare(
            "INSERT INTO save_snapshots SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM careers WHERE id=? AND revision=? AND last_command=?)",
          ).bind(
            crypto.randomUUID(),
            id,
            row.state,
            row.revision,
            now,
            id,
            revision,
            attempt,
          ),
        );
      const result = await env.DB.batch(batch);
      if (result[0].meta.changes !== 1) {
        const replay = await env.DB.prepare(
          "SELECT payload FROM processed_commands WHERE career_id=? AND command_id=?",
        )
          .bind(id, body.id)
          .first<{ payload: string }>();
        if (replay?.payload === payload) {
          const latest = await env.DB.prepare(
            "SELECT * FROM careers WHERE id=? AND user_id=?",
          )
            .bind(id, uid)
            .first<Row>();
          return json(view(latest!));
        }
        return json({ error: "State conflict; reload" }, 409);
      }
      return json({ id, name: row.name, state: next, revision });
    }
  }
  return json({ error: "Not found" }, 404);
}
export default {
  async fetch(req: Request, env: Env) {
    const origin = req.headers.get("Origin");
    const allowed = env.ALLOWED_ORIGIN.split(",").map((x) => x.trim());
    if (origin && !allowed.includes(origin))
      return json({ error: "Origin blocked" }, 403);
    if (
      ["POST", "DELETE"].includes(req.method) &&
      req.body &&
      !req.headers.get("Content-Type")?.startsWith("application/json")
    )
      return json({ error: "JSON required" }, 415);
    if (Number(req.headers.get("Content-Length") || 0) > 16384)
      return json({ error: "Body too large" }, 413);
    let response: Response;
    try {
      if (req.method === "OPTIONS")
        response = new Response(null, { status: 204 });
      else {
        if (req.body) {
          const body = await readLimitedBody(req.body);
          req = new Request(req.url, {
            method: req.method,
            headers: req.headers,
            body,
          });
        }
        response = await route(req, env);
      }
    } catch (error) {
      if (error instanceof PayloadTooLarge)
        response = json({ error: "Body too large" }, 413);
      else if (error instanceof RuleError)
        response = json({ error: error.message }, 422);
      else if (
        error instanceof SyntaxError ||
        (error as { name?: string }).name === "ZodError"
      )
        response = json({ error: "مدخلات غير صحيحة / Invalid input" }, 400);
      else
        response = json({ error: "تعذّر تنفيذ الطلب / Request failed" }, 500);
    }
    const headers = new Headers(response.headers);
    if (origin && allowed.includes(origin))
      headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    headers.set("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
    headers.set("Cache-Control", "no-store");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Referrer-Policy", "no-referrer");
    return new Response(response.body, { status: response.status, headers });
  },
} satisfies ExportedHandler<Env>;
