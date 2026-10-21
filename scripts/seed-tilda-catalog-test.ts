import "dotenv/config";
import { readFile } from "node:fs/promises";
import { db } from "../src/lib/db";
import { todayInMoscow } from "../src/lib/dates";
import { dedicatedTestDatabase } from "../src/lib/test-catalog";

if (!dedicatedTestDatabase() || process.env.ALLOW_TEST_SEED !== "true") {
  throw new Error("Tilda catalog seed requires the identified test database and ALLOW_TEST_SEED=true.");
}

type Product = {
  productUid: string; name: string; tildaUrl: string; maxGuests: number | null;
  publicBaseRates: { weekday: number; friday: number; saturday: number; sunday: number };
};
const snapshot = JSON.parse(await readFile(new URL("../data/tilda-catalog-public.json", import.meta.url), "utf8")) as {
  products: Product[];
};
const details = JSON.parse(await readFile(new URL("../data/tilda-catalog-details.json", import.meta.url), "utf8")) as {
  products: { productUid: string; bedrooms: number | null; amenities: string[];
    includedGuests: number | null; extraGuestPrice: number; serviceFee: number }[];
};
const byUid = new Map(details.products.map(product => [product.productUid, product]));
if (!Array.isArray(snapshot.products) || snapshot.products.length !== 63 ||
    new Set(snapshot.products.map((product) => product.productUid)).size !== snapshot.products.length) {
  throw new Error("Review the public Tilda snapshot before seeding.");
}
const start = todayInMoscow();
const end = new Date(start.getTime() + 365 * 86_400_000);

try {
  let created = 0;
  for (const product of snapshot.products) {
    const uid = product.productUid;
    const rates = product.publicBaseRates;
    if (!/^\d+$/.test(uid) || !product.name ||
        !product.tildaUrl.startsWith(`https://domkazan116.ru/tproduct/${uid}-`) ||
        Object.values(rates).some((rate) => !Number.isSafeInteger(rate) || rate <= 0) ||
        (product.maxGuests !== null && (!Number.isSafeInteger(product.maxGuests) || product.maxGuests < 1))) {
      throw new Error(`Unreviewed public metadata for Tilda UID ${uid}`);
    }
    const slug = `tilda-${uid}`;
    const detail = byUid.get(uid);
    const metadata = detail ? { bedrooms: detail.bedrooms, amenities: detail.amenities,
      includedGuests: detail.includedGuests && detail.includedGuests <= (product.maxGuests ?? 12) ? detail.includedGuests : null,
      extraGuestPrice: detail.includedGuests && detail.includedGuests <= (product.maxGuests ?? 12) ? detail.extraGuestPrice : 0,
      serviceFee: detail.serviceFee } : {};
    const existing = await db.house.findUnique({ where: { tildaProductUid: uid } }) ?? await db.house.findUnique({ where: { slug } });
    if (existing) {
      // Upgrade untouched test fixtures only. Owner/tester edits always win.
      if (existing.revision === 0 && (!existing.tildaProductUid || existing.tildaProductUid === uid)) await db.house.updateMany({ where: { id: existing.id, revision: 0 }, data: {
        ...metadata, ...(!existing.tildaProductUid && existing.slug === slug ? { tildaProductUid: uid } : {}),
      } });
      continue;
    }
    await db.house.create({ data: {
      id: slug, slug, tildaProductUid: uid, name: product.name, tildaUrl: product.tildaUrl,
      ...metadata,
      // Chebaksa allows 6 adults and 6 children. A single guest count cannot enforce that rule.
      maxGuests: product.maxGuests ?? 12, isActive: product.maxGuests !== null,
      baseRates: { create: [{ startsOn: start, endsOn: end,
        weekdayPrice: rates.weekday, fridayPrice: rates.friday,
        saturdayPrice: rates.saturday, sundayPrice: rates.sunday, minNights: 1 }] },
    } });
    created++;
  }
  console.log(`Tilda public catalog test snapshot: ${snapshot.products.length} houses (${created} created); no occupancy or client data imported.`);
} finally { await db.$disconnect(); }
