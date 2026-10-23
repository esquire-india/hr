import dotenv from "dotenv";
import { resolve } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { Store } from "./server/store";
import { openCloudStore } from "./server/cloud-store";
import { createApp } from "./server/app";
import { configuredMailer } from "./server/integrations";
import { serveClient } from "./server/client";
import { hashPassword } from "./server/auth";
dotenv.config({ path: [".env.local", ".env"], quiet: true });
const production = process.env.NODE_ENV === "production";
let store: Store | undefined;

/**
 * Auto-create / promote HR-admin accounts for every email listed in
 * ADMIN_EMAILS at server start.  If the org doesn't exist yet (first run
 * before registration) this is a no-op and will be triggered next restart.
 */
async function provisionAdminAccounts(store: Store) {
  const raw = (process.env.ADMIN_EMAILS || "").trim();
  if (!raw) return;
  const adminEmails = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!adminEmails.length) return;

  const org = (await store.db
    .prepare("SELECT id FROM organizations LIMIT 1")
    .get()) as { id: string } | undefined;
  if (!org) return; // no org yet — will run after first registration restart

  for (const addr of adminEmails) {
    const existing = (await store.db
      .prepare("SELECT id, role FROM users WHERE org_id=? AND lower(email)=?")
      .get(org.id, addr)) as { id: string; role: string } | undefined;

    if (existing) {
      // Ensure the account has at least 'hr' privileges
      if (existing.role !== "owner" && existing.role !== "hr") {
        await store.db
          .prepare("UPDATE users SET role='hr', must_change=0, active=1 WHERE id=?")
          .run(existing.id);
        console.log(`[Admin] Promoted ${addr} to hr`);
      }
      continue;
    }

    // Try to link to an existing employee record
    const emp = (await store.db
      .prepare(
        `SELECT id, json_extract(data,'$.name') AS name FROM records
         WHERE org_id=? AND kind='employees'
           AND lower(json_extract(data,'$.email'))=? LIMIT 1`,
      )
      .get(org.id, addr)) as { id: string; name: string } | undefined;

    const tempPassword = randomBytes(10).toString("base64url");
    const hash = await hashPassword(tempPassword);
    const userId = randomUUID();
    const displayName = emp?.name ?? addr.split("@")[0];

    await store.db
      .prepare(
        "INSERT OR IGNORE INTO users(id,org_id,name,email,password_hash,role,employee_id,must_change,active) VALUES(?,?,?,?,?,'hr',?,0,1)",
      )
      .run(userId, org.id, displayName, addr, hash, emp?.id ?? null);

    console.log(`[Admin] ✅  Created HR admin: ${addr}`);
    console.log(`              Temp password : ${tempPassword}`);
    console.log(`              They can change it via Settings → Change Password.`);
  }
}

async function start() {
  store =
    process.env.DATABASE_URL || process.env.SUPABASE_DB_URL
      ? await openCloudStore()
      : new Store(resolve(process.env.DATABASE_PATH || "var/hrstudio.sqlite"));
  const app = createApp(store, {
    secureCookies: process.env.COOKIE_SECURE
      ? process.env.COOKIE_SECURE === "true"
      : production,
    appUrl:
      process.env.APP_URL && !process.env.APP_URL.includes("MY_APP_URL")
        ? process.env.APP_URL
        : undefined,
    mailer: configuredMailer(),
    registrationOpen: process.env.REGISTRATION_OPEN !== "false",
    demoLoginEnabled: process.env.DEMO_LOGIN_ENABLED === "true",
  });
  await provisionAdminAccounts(store);
  if (!production) {
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    serveClient(app, resolve("dist/public"));
  }
  const port = Number(process.env.PORT || 3000),
    host = process.env.HOST || "127.0.0.1";
  const server = app.listen(port, host, () =>
    console.log(`HR Studio: http://${host}:${port}`),
  );
  const stop = () =>
    server.close(async () => {
      await store.close();
      process.exit(0);
    });
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}
start().catch(async (error) => {
  console.error(
    "HR Studio could not start. Check the server database configuration.",
  );
  await store?.close();
  process.exitCode = 1;
});
