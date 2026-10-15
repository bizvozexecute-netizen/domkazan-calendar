import { randomBytes, scryptSync } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

const path = ".env.local-test";
if (!existsSync(path)) {
  const password = randomBytes(18).toString("hex");
  const databasePassword = randomBytes(24).toString("hex");
  const salt = randomBytes(16).toString("hex");
  const hash = `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
  const environment = {
    POSTGRES_DB: "domkazan_calendar_demo_test", POSTGRES_PASSWORD: databasePassword,
    DATABASE_URL: `postgresql://domkazan:${databasePassword}@postgres:5432/domkazan_calendar_demo_test`,
    ADMIN_EMAIL: "tester@example.invalid", ADMIN_PASSWORD_HASH: hash,
    SESSION_SECRET: randomBytes(32).toString("hex"), TRUSTED_PROXY_SECRET: randomBytes(32).toString("hex"),
    TELEGRAM_RETRY_SECRET: randomBytes(32).toString("hex"), TELEGRAM_BOT_TOKEN: "", TELEGRAM_CHAT_ID: "",
    APP_ORIGIN: "https://localhost:8443", TILDA_ORIGIN: "https://domkazan116.ru",
    PRIVACY_POLICY_URL: "https://localhost:8443/test-policy", TEST_CATALOG_ENABLED: "true", ALLOW_TEST_SEED: "true",
    PUBLIC_OWNER_PHONE: "", PUBLIC_OWNER_TELEGRAM: "", PUBLIC_OWNER_WHATSAPP: "",
  };
  writeFileSync(path, Object.entries(environment).map(([key, value]) => `${key}='${value}'`).join("\n") + "\n", { mode: 0o600, flag: "wx" });
  writeFileSync(".local-test-credentials.json", JSON.stringify({ email: environment.ADMIN_EMAIL, password }, null, 2) + "\n", { mode: 0o600, flag: "wx" });
  console.log("Created local-only settings. Test login is in .local-test-credentials.json (gitignored).");
} else console.log("Preserving existing .env.local-test and database credentials.");
mkdirSync("backups", { recursive: true, mode: 0o700 });
