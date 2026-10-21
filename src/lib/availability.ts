import { db } from "@/lib/db";
import { quoteStay } from "@/lib/pricing";

export type HouseFilters = {
  guests: number;
  district?: string;
  bedrooms?: number;
  amenities?: string[];
  petsAllowed?: boolean;
  house?: string;
};

export async function findAvailableHouses(checkIn: Date, checkOut: Date, filters: HouseFilters) {
  const houses = await db.house.findMany({
    where: {
      isActive: true,
      ...(filters.house && { slug: filters.house }),
      maxGuests: { gte: filters.guests },
      ...(filters.district && { district: { equals: filters.district, mode: "insensitive" as const } }),
      ...(filters.bedrooms && { bedrooms: { gte: filters.bedrooms } }),
      ...(filters.amenities?.length && { amenities: { hasEvery: filters.amenities } }),
      ...(filters.petsAllowed && { petsAllowed: true }),
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
    const quote = quoteStay(checkIn, checkOut, house.baseRates, house.dateOverrides,
      { guests: filters.guests, includedGuests: house.includedGuests, extraGuestPrice: house.extraGuestPrice, serviceFee: house.serviceFee });
    if (!quote) return [];
    return [{
      id: house.id,
      slug: house.slug,
      name: house.name,
      maxGuests: house.maxGuests,
      district: house.district,
      bedrooms: house.bedrooms,
      bathrooms: house.bathrooms,
      amenities: house.amenities,
      petsAllowed: house.petsAllowed,
      tildaUrl: house.tildaUrl,
      quote,
    }];
  });
}
