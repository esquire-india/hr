import dotenv from "dotenv";
import { connectPostgresDatabase } from "../server/postgres";
import { initializeCloudDemo } from "../server/cloud-setup";
dotenv.config({ path: [".env.local", ".env"], quiet: true });

const isDemoDeployment = process.argv.includes("--demo-deployment");
const hasDbUrl = Boolean(
  process.env.DATABASE_URL_UNPOOLED?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    process.env.SUPABASE_DB_URL?.trim(),
);

if (isDemoDeployment) {
  if (process.env.DEMO_LOGIN_ENABLED !== "true") {
    console.log(
      "Demo deployment setup skipped: DEMO_LOGIN_ENABLED is not set to 'true'.",
    );
    process.exit(0);
  }
  if (!hasDbUrl) {
    console.log(
      "Demo deployment setup skipped: DATABASE_URL is not configured.",
    );
    process.exit(0);
  }
}

let db: ReturnType<typeof connectPostgresDatabase> | undefined;
try {
  db = connectPostgresDatabase({
    ...process.env,
    DATABASE_URL:
      process.env.DATABASE_URL_UNPOOLED?.trim() || process.env.DATABASE_URL,
  });
  console.log(await initializeCloudDemo(db));
} catch {
  console.error(
    "Database setup failed. Check DATABASE_URL (or DATABASE_URL_UNPOOLED for setup), the database password, TLS certificate and project status. No credentials were printed.",
  );
  if (!isDemoDeployment) {
    process.exitCode = 1;
  } else {
    console.warn("Continuing deployment build without demo database seeding.");
  }
} finally {
  await db?.close();
}

