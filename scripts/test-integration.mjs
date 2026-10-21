import "dotenv/config";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) {
  console.error("Set TEST_DATABASE_URL to a dedicated PostgreSQL test database.");
  process.exit(1);
}
const database = new URL(testUrl).pathname.slice(1);
if (!database.endsWith("_test") || testUrl === process.env.DATABASE_URL) {
  console.error("Integration tests require a separate database with a name ending in _test.");
  process.exit(1);
}
const environment = { ...process.env, DATABASE_URL: testUrl };
const prismaCli = resolve("node_modules/prisma/build/index.js");
const generate = spawnSync(process.execPath, [prismaCli, "generate"], { stdio: "inherit", env: environment });
if (generate.status !== 0) process.exit(generate.status || 1);
const migration = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], { stdio: "inherit", env: environment });
if (migration.status !== 0) process.exit(migration.status || 1);
const tests = spawnSync(process.execPath, ["--import", "tsx", "--test", "--test-concurrency=1", "tests/integration.test.ts", "tests/admin-integration.test.ts", "tests/requests-integration.test.ts", "tests/public-calendar-integration.test.ts"], { stdio: "inherit", env: environment });
process.exit(tests.status || 0);
