import { randomBytes, randomUUID } from "node:crypto";
import type { Store } from "./store";
import { hashPassword } from "./auth";

/**
 * Auto-create / promote HR-admin accounts for every email listed in
 * ADMIN_EMAILS. If the org doesn't exist yet (before first registration)
 * this is a no-op and will be triggered once an org is registered.
 */
export async function provisionAdminAccounts(store: Store) {
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
  if (!org) return; // no org yet — will run after first registration

  for (const addr of adminEmails) {
    const existing = (await store.db
      .prepare("SELECT id, role FROM users WHERE org_id=? AND lower(email)=?")
      .get(org.id, addr)) as { id: string; role: string } | undefined;

    if (existing) {
      if (existing.role !== "owner" && existing.role !== "hr") {
        await store.db
          .prepare(
            "UPDATE users SET role='hr', must_change=0, active=1 WHERE id=?",
          )
          .run(existing.id);
        console.log(`[Admin] Promoted ${addr} to hr`);
      }
      continue;
    }

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
        "INSERT INTO users(id,org_id,name,email,password_hash,role,employee_id,must_change,active) VALUES(?,?,?,?,?,'hr',?,0,1)",
      )
      .run(userId, org.id, displayName, addr, hash, emp?.id ?? null);

    console.log(`[Admin] ✅ Created HR admin: ${addr}`);
    console.log(`              Temp password : ${tempPassword}`);
    console.log(
      `              They can change it via Settings → Change Password.`,
    );
  }
}
