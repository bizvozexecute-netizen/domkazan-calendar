export function testCatalogEnabled(): boolean {
  try {
    return process.env.TEST_CATALOG_ENABLED === "true" && new URL(process.env.DATABASE_URL ?? "").pathname.endsWith("_test");
  } catch { return false; }
}
