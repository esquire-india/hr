/**
 * add-admin-users.mjs
 * -----------------------------------------------------------------------
 * One-time script to upsert two HR-admin accounts into the SQLite database.
 *
 * Usage:
 *   node scripts/add-admin-users.mjs
 *
 * What it does:
 *  - Finds the first (and usually only) organization in the DB.
 *  - For each target email it either:
 *      a) Creates a brand-new HR account with a temporary password, or
 *      b) Upgrades an existing employee/owner account's role to 'hr'.
 *  - Sets must_change=1 so the user is forced to change their password on
 *    first login via Settings → Change Password in the app.
 * -----------------------------------------------------------------------
 */

import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, scrypt } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// ── Load .env.local so DATABASE_PATH is respected ───────────────────────────
function loadEnv(file) {
  try {
    const raw = readFileSync(resolve(root, file), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch { /* file not present – fine */ }
}
loadEnv('.env.local');
loadEnv('.env');

// ── Config ───────────────────────────────────────────────────────────────────
const DB_PATH = resolve(root, process.env.DATABASE_PATH || 'var/hrstudio.sqlite');

const ADMIN_EMAILS = [
  'nagnath.salagare@esquirehl.com',
  'sanil@esquirehl.com',
];

// ── Crypto helpers (same algorithm as server/auth.ts) ────────────────────────
function deriveKey(password, salt) {
  return new Promise((resolve, reject) =>
    scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (err, key) => err ? reject(err) : resolve(key))
  );
}
async function hashPassword(value) {
  const salt = randomBytes(16).toString('hex');
  const key = await deriveKey(value, salt);
  return `scrypt:${salt}:${key.toString('hex')}`;
}
function randomUUID() {
  // Use built-in crypto.randomUUID if available (Node 16.7+), else build one
  return crypto.randomUUID?.() ??
    ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
      (c ^ (randomBytes(1)[0] & (15 >> (c / 4)))).toString(16));
}

// ── Main ─────────────────────────────────────────────────────────────────────
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;');

const org = db.prepare('SELECT id FROM organizations LIMIT 1').get();
if (!org) {
  console.error('❌  No organization found. Register your company first, then re-run this script.');
  process.exit(1);
}
const orgId = org.id;
console.log(`✅  Organization: ${orgId}\n`);

for (const emailAddr of ADMIN_EMAILS) {
  const addr = emailAddr.toLowerCase().trim();

  // Check for an existing user account with this email
  const existing = db.prepare(
    'SELECT id, name, role FROM users WHERE org_id=? AND lower(email)=?'
  ).get(orgId, addr);

  // Check for a matching employee record (to link the account)
  const employee = db.prepare(
    `SELECT id, name FROM records
     WHERE org_id=? AND kind='employees'
       AND lower(json_extract(data,'$.email'))=?
     LIMIT 1`
  ).get(orgId, addr);

  const displayName = employee?.name ?? existing?.name ?? addr.split('@')[0];
  const tempPassword = randomBytes(10).toString('base64url'); // e.g. "aB3dF7gH9K"

  if (existing) {
    if (existing.role === 'owner') {
      console.log(`⚠️  ${addr} — is already the OWNER. Keeping as-is (owners have full access).`);
      continue;
    }
    if (existing.role === 'hr') {
      // Reset their temp password so they can log in fresh
      const hash = await hashPassword(tempPassword);
      db.prepare('UPDATE users SET password_hash=?, must_change=1 WHERE id=?')
        .run(hash, existing.id);
      console.log(`🔄  ${addr} — already HR admin. Temp password reset.`);
    } else {
      // Upgrade employee → hr
      const hash = await hashPassword(tempPassword);
      db.prepare('UPDATE users SET role=?, password_hash=?, must_change=1 WHERE id=?')
        .run('hr', hash, existing.id);
      console.log(`⬆️  ${addr} — upgraded from '${existing.role}' to 'hr' admin.`);
    }
    console.log(`   🔑  Temporary password: ${tempPassword}`);
    console.log(`   ℹ️  They MUST change it on first login via Settings → Change Password.\n`);
  } else {
    // Create brand-new hr account
    const hash = await hashPassword(tempPassword);
    const userId = randomUUID();
    db.prepare(
      'INSERT INTO users(id,org_id,name,email,password_hash,role,employee_id,must_change) VALUES(?,?,?,?,?,?,?,1)'
    ).run(userId, orgId, displayName, addr, hash, 'hr', employee?.id ?? null);
    console.log(`✨  ${addr} — new HR admin account created.`);
    console.log(`   👤  Name: ${displayName}`);
    console.log(`   🔑  Temporary password: ${tempPassword}`);
    console.log(`   ℹ️  They MUST change it on first login via Settings → Change Password.\n`);
  }
}

db.close();
console.log('Done. Share the temporary passwords securely — they expire on first use.');
