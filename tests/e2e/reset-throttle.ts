import {db} from "../../src/lib/db";
export async function resetTestThrottle() {
  if (!new URL(process.env.DATABASE_URL || "").pathname.endsWith("_test")) throw new Error("Throttle reset requires a disposable *_test database");
  // Browser widths reuse the one allowed fictional phone. Isolate test cases,
  // preserving the real application's five-per-phone limit unchanged.
  await db.requestThrottle.deleteMany();
}
