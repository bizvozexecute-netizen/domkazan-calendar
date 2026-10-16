import { randomBytes, scryptSync } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const envPath = resolve(root, ".env.vpn-test");
const credentialsPath = resolve(root, ".vpn-test-credentials.json");
const backupPath = resolve(root, "backups");
const expected = {
  "--app-image": "ghcr.io/bizvozexecute-netizen/domkazan-calendar-app",
  "--tools-image": "ghcr.io/bizvozexecute-netizen/domkazan-calendar-tools",
  "--tls-image": "ghcr.io/bizvozexecute-netizen/domkazan-calendar-tls",
};
const args = process.argv.slice(2);
if (args.length !== 6 || args.some((arg, i) => i % 2 === 0 && !(arg in expected))) {
  throw new Error("Specify --app-image, --tools-image and --tls-image with GHCR sha256 digests.");
}
const options = Object.fromEntries([[args[0], args[1]], [args[2], args[3]], [args[4], args[5]]]);
if (Object.keys(options).length !== 3) throw new Error("Each image option is required exactly once.");
for (const [option, prefix] of Object.entries(expected)) {
  if (!new RegExp(`^${prefix.replaceAll(".", "\\.")}@sha256:[0-9a-f]{64}$`).test(options[option])) {
    throw new Error(`${option} must name ${prefix} by immutable sha256 digest.`);
  }
}
if (existsSync(envPath) || existsSync(credentialsPath)) {
  throw new Error("Settings or credentials already exist. Refusing to overwrite either file.");
}
const adminPassword = randomBytes(18).toString("hex");
const databasePassword = randomBytes(24).toString("hex");
const salt = randomBytes(16).toString("hex");
const hash = `scrypt:${salt}:${scryptSync(adminPassword, salt, 64).toString("hex")}`;
const settings = {
  APP_IMAGE: options["--app-image"],
  TOOLS_IMAGE: options["--tools-image"],
  TLS_IMAGE: options["--tls-image"],
  POSTGRES_PASSWORD: databasePassword,
  DATABASE_URL: `postgresql://domkazan:${databasePassword}@postgres:5432/domkazan_vpn_test`,
  ADMIN_EMAIL: "tester@example.invalid",
  ADMIN_PASSWORD_HASH: hash,
  SESSION_SECRET: randomBytes(32).toString("hex"),
  TRUSTED_PROXY_SECRET: randomBytes(32).toString("hex"),
  TELEGRAM_RETRY_SECRET: randomBytes(32).toString("hex"),
};
const env = Object.entries(settings).map(([key, value]) => `${key}=${value}`).join("\n") + "\n";
writeFileSync(envPath, env, { mode: 0o600, flag: "wx" });
writeFileSync(credentialsPath, JSON.stringify({ email: settings.ADMIN_EMAIL, password: adminPassword }, null, 2) + "\n",
  { mode: 0o600, flag: "wx" });
mkdirSync(backupPath, { recursive: true, mode: 0o700 });
console.log("Created .env.vpn-test and .vpn-test-credentials.json with random test-only secrets.");
