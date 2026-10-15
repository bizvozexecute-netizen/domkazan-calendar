import "dotenv/config";
import { randomBytes, scryptSync } from "node:crypto";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test") || url === process.env.DATABASE_URL) {
  throw new Error("E2E needs a separate TEST_DATABASE_URL ending in _test");
}
const password = randomBytes(24).toString("hex");
const salt = randomBytes(16).toString("hex");
const env = { ...process.env, DATABASE_URL: url, ALLOW_TEST_SEED: "true", TEST_CATALOG_ENABLED: "true",
  PORT: "3100", HOSTNAME: "127.0.0.1",
  APP_ORIGIN: "http://localhost:3100", ALLOW_INSECURE_LOCAL_HTTP: "true", TILDA_ORIGIN: "https://domkazan116.ru",
  PRIVACY_POLICY_URL: "https://example.invalid/privacy", ADMIN_EMAIL: "browser-tester@example.invalid",
  ADMIN_PASSWORD_HASH: `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`,
  E2E_ADMIN_PASSWORD: password, SESSION_SECRET: randomBytes(32).toString("hex"),
  TRUSTED_PROXY_SECRET: randomBytes(32).toString("hex"), TELEGRAM_RETRY_SECRET: randomBytes(32).toString("hex"),
  TELEGRAM_BOT_TOKEN: "", TELEGRAM_CHAT_ID: "", PUBLIC_OWNER_PHONE: "", PUBLIC_OWNER_TELEGRAM: "", PUBLIC_OWNER_WHATSAPP: "" };
function run(args) {
  const result = spawnSync(process.execPath, args, { env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}
run([resolve("node_modules/prisma/build/index.js"), "migrate", "deploy"]);
run(["--import", "tsx", "scripts/seed-test.ts"]);
run([resolve("node_modules/@playwright/test/cli.js"), "test"]);
