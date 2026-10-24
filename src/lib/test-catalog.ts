import { createHash, timingSafeEqual } from "node:crypto";

export function dedicatedTestDatabase(env: Record<string, string | undefined> = process.env): boolean {
  try {
    const url = env.DATABASE_URL;
    if (!url) return false;
    const database = new URL(url);
    if (!env.VERCEL_ENV) return database.pathname.endsWith("_test");
    if (env.VERCEL_ENV !== "preview" || database.hostname !== "db.prisma.io") return false;
    const expected = env.TEST_DATABASE_URL_SHA256;
    if (!expected || !/^[a-f0-9]{64}$/.test(expected)) return false;
    const actual = createHash("sha256").update(url).digest();
    return timingSafeEqual(actual, Buffer.from(expected, "hex"));
  } catch { return false; }
}

export function testCatalogEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.TEST_CATALOG_ENABLED === "true" && dedicatedTestDatabase(env);
}
