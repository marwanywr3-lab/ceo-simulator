import fs from "node:fs";
const args = Object.fromEntries(
  process.argv.slice(2).map((s) => {
    const i = s.indexOf("=");
    return [s.slice(0, i), s.slice(i + 1)];
  }),
);
const id = args["--database-id"],
  origin = args["--origin"];
if (
  !id ||
  !/^[0-9a-f-]{36}$/i.test(id) ||
  !origin ||
  new URL(origin).protocol !== "https:"
)
  throw new Error(
    "Usage: node scripts/configure-production.mjs --database-id=<real D1 UUID> --origin=https://<frontend-host> [--google-client-id=<public OAuth client ID>]",
  );
const vars = { ALLOWED_ORIGIN: new URL(origin).origin };
if (args["--google-client-id"])
  vars.GOOGLE_CLIENT_ID = args["--google-client-id"];
fs.writeFileSync(
  "apps/api/wrangler.production.jsonc",
  JSON.stringify(
    {
      name: "ceo-simulator-api",
      main: "index.ts",
      compatibility_date: "2026-10-23",
      compatibility_flags: ["nodejs_compat"],
      d1_databases: [
        {
          binding: "DB",
          database_name: "ceo-simulator-production",
          database_id: id,
          migrations_dir: "../../database/migrations",
        },
      ],
      vars,
      observability: { enabled: true },
    },
    null,
    2,
  ),
);
console.log(
  "Production configuration written. No resources created or deployed.",
);
