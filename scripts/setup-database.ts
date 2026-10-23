import dotenv from "dotenv";
import { connectPostgresDatabase } from "../server/postgres";
import {
  initializeCloudDemo,
  initializeCloudProduction,
} from "../server/cloud-setup";
dotenv.config({ path: [".env.local", ".env"], quiet: true });

const isDemoDeployment = process.argv.includes("--demo-deployment");
const hasDbUrl = Boolean(
  process.env.DATABASE_URL_UNPOOLED?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    process.env.SUPABASE_DB_URL?.trim(),
);

if (!hasDbUrl) {
  if (isDemoDeployment) {
    console.log(
      "Database setup skipped: DATABASE_URL is not configured in environment.",
    );
    process.exit(0);
  }
  console.error(
    "Cannot setup database: DATABASE_URL (or DATABASE_URL_UNPOOLED) is not set in environment or .env.local.",
  );
  process.exit(1);
}

let db: ReturnType<typeof connectPostgresDatabase> | undefined;
try {
  db = connectPostgresDatabase({
    ...process.env,
    DATABASE_URL:
      process.env.DATABASE_URL_UNPOOLED?.trim() || process.env.DATABASE_URL,
  });

  if (process.env.DEMO_LOGIN_ENABLED === "true") {
    console.log(await initializeCloudDemo(db));
  } else {
    console.log(await initializeCloudProduction(db));
  }
} catch {
  console.error(
    "Database setup failed. Check DATABASE_URL (or DATABASE_URL_UNPOOLED for setup), the database password, TLS certificate and project status. No credentials were printed.",
  );
  if (!isDemoDeployment) {
    process.exitCode = 1;
  } else {
    console.warn("Continuing deployment build without database initialization.");
  }
} finally {
  await db?.close();
}


