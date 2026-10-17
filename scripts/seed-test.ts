import "dotenv/config";
import { db } from "../src/lib/db";
import { todayInMoscow } from "../src/lib/dates";
import { dedicatedTestDatabase } from "../src/lib/test-catalog";

if (!dedicatedTestDatabase() || process.env.ALLOW_TEST_SEED !== "true") {
  throw new Error("Seed is allowed only for an identified test database with ALLOW_TEST_SEED=true.");
}
const names = ["Сосновый свет", "Тихий ручей", "Лунная поляна", "Берёзовый остров", "Лесной маяк", "Кедровый ветер", "Облачный берег", "Звёздная терраса", "Дом за радугой"];
const districts = ["Тестовый север", "Тестовый юг", "Тестовый восток"];
const start = todayInMoscow();
const day = (offset: number) => new Date(start.getTime() + offset * 86_400_000);
try {
  let created = 0;
  for (const [index, name] of names.entries()) {
    const id = `demo-house-${String(index + 1).padStart(2, "0")}`;
    const existing = await db.house.findUnique({ where: { slug: id } });
    if (existing) continue; // Never reset edits or bookings made by a tester.
    const price = 4000 + index * 1500;
    await db.house.create({ data: {
      id, slug: id, name: `Тестовый дом «${name}»`, tildaUrl: `https://example.invalid/${id}`,
      maxGuests: 4 + index * 2, district: districts[index % 3], bedrooms: 1 + Math.floor(index / 2),
      bathrooms: 1 + index % 3, amenities: index % 2 ? ["wifi", "sauna", "barbecue"] : ["wifi", "fireplace"],
      petsAllowed: index % 2 === 0, isActive: index !== 8,
      baseRates: { create: [
        { startsOn: start, endsOn: day(90), weekdayPrice: price, fridayPrice: price + 2000,
          saturdayPrice: price + 4000, sundayPrice: price + 1000, minNights: index % 3 === 0 ? 2 : 1 },
        { startsOn: day(90), endsOn: day(365), weekdayPrice: price + 1000, fridayPrice: price + 3000,
          saturdayPrice: price + 5000, sundayPrice: price + 2000, minNights: 1 },
      ] },
      dateOverrides: { create: [{ date: day(5 + index), pricePerNight: price + 7000 }] },
      blockedPeriods: { create: [{ startsOn: day(10 + index * 3), endsOn: day(12 + index * 3), reason: "Вымышленное тестовое закрытие" }] },
    } });
    created++;
  }
  console.log(`Synthetic houses ready: 9 (${created} created). Existing tester edits preserved. No client records seeded.`);
} finally { await db.$disconnect(); }
