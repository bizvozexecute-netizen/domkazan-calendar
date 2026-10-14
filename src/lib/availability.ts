import { db } from "@/lib/db";
import { quoteStay } from "@/lib/pricing";

export async function findAvailableHouses(checkIn: Date, checkOut: Date, guests: number) {
  const houses = await db.house.findMany({
    where: {
      isActive: true,
      maxGuests: { gte: guests },
      blockedPeriods: { none: { startsOn: { lt: checkOut }, endsOn: { gt: checkIn } } },
      bookingRequests: {
        none: { status: "CONFIRMED", checkIn: { lt: checkOut }, checkOut: { gt: checkIn } },
      },
    },
    include: {
      baseRates: { where: { startsOn: { lt: checkOut }, endsOn: { gt: checkIn } } },
      dateOverrides: { where: { date: { gte: checkIn, lt: checkOut } } },
    },
    orderBy: { name: "asc" },
  });

  return houses.flatMap((house) => {
    const quote = quoteStay(checkIn, checkOut, house.baseRates, house.dateOverrides);
    if (!quote) return [];
    return [{
      id: house.id,
      slug: house.slug,
      name: house.name,
      maxGuests: house.maxGuests,
      tildaUrl: house.tildaUrl,
      quote,
    }];
  });
}
