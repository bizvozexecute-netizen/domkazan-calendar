import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { dedicatedTestDatabase, testCatalogEnabled } from "../src/lib/test-catalog.ts";

const url = "postgres://synthetic:synthetic@db.prisma.io/postgres?sslmode=require";
const fingerprint = createHash("sha256").update(url).digest("hex");

test("Prisma Postgres preview requires its exact connection fingerprint", () => {
  const env = { VERCEL_ENV: "preview", DATABASE_URL: url, TEST_DATABASE_URL_SHA256: fingerprint, TEST_CATALOG_ENABLED: "true" };
  assert.equal(dedicatedTestDatabase(env), true);
  assert.equal(testCatalogEnabled(env), true);
  assert.equal(dedicatedTestDatabase({ ...env, DATABASE_URL: `${url}&changed=1` }), false);
  assert.equal(dedicatedTestDatabase({ ...env, VERCEL_ENV: "production" }), false);
  assert.equal(dedicatedTestDatabase({ ...env, TEST_DATABASE_URL_SHA256: "0".repeat(64) }), false);
  assert.equal(testCatalogEnabled({ ...env, TEST_CATALOG_ENABLED: "false" }), false);
});

test("isolated Docker test database retains its name guard", () => {
  assert.equal(dedicatedTestDatabase({ DATABASE_URL: "postgres://synthetic:synthetic@postgres/domkazan_vpn_test" }), true);
  assert.equal(dedicatedTestDatabase({ DATABASE_URL: "postgres://synthetic:synthetic@postgres/domkazan" }), false);
});
