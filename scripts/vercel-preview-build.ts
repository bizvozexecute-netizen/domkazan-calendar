import { spawnSync } from "node:child_process";
import { dedicatedTestDatabase } from "../src/lib/test-catalog";

if (process.env.VERCEL_ENV !== "preview" || process.env.TEST_CATALOG_ENABLED !== "true" || !dedicatedTestDatabase()) {
  throw new Error("Vercel test build requires Preview and the identified test database.");
}

function run(command: string, args: string[], env = process.env) {
  const result = spawnSync(command, args, { env, stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("npm", ["run", "db:deploy"]);
run("npm", ["run", "db:seed:test"], { ...process.env, ALLOW_TEST_SEED: "true" });
run("npm", ["run", "build"]);
