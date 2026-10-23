import type { IncomingMessage, ServerResponse } from "node:http";
import { createApp } from "./app";
import { configuredMailer } from "./integrations";
import { openCloudStore } from "./cloud-store";
import type { Store } from "./store";

import { provisionAdminAccounts } from "./admin-provision";

export function vercelOrigin(env: NodeJS.ProcessEnv) {
  const raw =
    env.APP_URL || (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : "");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Set APP_URL to the public HTTPS origin.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error("APP_URL must be an HTTPS origin.");
  return url.origin;
}

export function createVercelHandler(
  env: NodeJS.ProcessEnv = process.env,
  openStore: () => Store | Promise<Store> = () => openCloudStore(env),
) {
  let initialization: Promise<ReturnType<typeof createApp>> | undefined;
  async function initialize() {
    let store: Store | undefined;
    try {
      const appUrl = vercelOrigin(env);
      store = await openStore();
      await provisionAdminAccounts(store).catch((err) => {
        console.error("Admin auto-provisioning error:", err);
      });
      return createApp(store, {
        appUrl,
        secureCookies: true,
        registrationOpen: env.REGISTRATION_OPEN === "true",
        demoLoginEnabled: env.DEMO_LOGIN_ENABLED === "true",
        mailer: configuredMailer(),
      });
    } catch (error) {
      await store?.close();
      throw error;
    }
  }
  return async (req: IncomingMessage, res: ServerResponse) => {
    try {
      // Concurrent cold-start requests share one connection/setup attempt.
      const app = await (initialization ??= initialize().catch((error) => {
        initialization = undefined;
        throw error;
      }));
      return app(req, res);
    } catch {
      console.error(
        "Vercel API initialization failed. Check Neon DATABASE_URL and database setup.",
      );
      res.statusCode = 503;
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Content-Type", "application/json");
      return res.end(
        JSON.stringify({
          error:
            "Neon database is not connected yet. Please configure DATABASE_URL with your Neon PostgreSQL connection string.",
        }),
      );
    }
  };
}

