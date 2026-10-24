import { db } from "@/lib/db";
import { quoteStay } from "@/lib/pricing";
import { publicHouseIdentity } from "./public-house-identity";
import { eachNight, nightsBetween } from "./dates";

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
      ...(filters.house && publicHouseIdentity(filters.house)),
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
      tildaProductUid: house.tildaProductUid,
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

// Public reason codes only: never expose booking IDs, contacts or internal errors.
export async function findHouseUnavailability(checkIn: Date, checkOut: Date, filters: HouseFilters) {
  if (!filters.house) return undefined;
  const house = await db.house.findFirst({where: {isActive: true, ...publicHouseIdentity(filters.house)}, include: {
    baseRates: {where: {startsOn: {lt: checkOut}, endsOn: {gt: checkIn}}},
    dateOverrides: {where: {date: {gte: checkIn, lt: checkOut}}},
    blockedPeriods: {where: {startsOn: {lt: checkOut}, endsOn: {gt: checkIn}}, select: {id: true}, take: 1},
    bookingRequests: {where: {status: "CONFIRMED", checkIn: {lt: checkOut}, checkOut: {gt: checkIn}}, select: {id: true}, take: 1},
  }});
  if (!house) return {code: "UNAVAILABLE"};
  if (filters.guests > house.maxGuests) return {code: "CAPACITY", maxGuests: house.maxGuests};
  if (house.blockedPeriods.length || house.bookingRequests.length) return {code: "OCCUPIED"};
  const nights = [...eachNight(checkIn, checkOut)];
  if (nights.some(night => !house.dateOverrides.some(value => value.date.getTime() === night.getTime()) && !house.baseRates.some(rate => rate.startsOn <= night && night < rate.endsOn))) return {code: "UNPRICED"};
  const minNights = Math.max(1, ...house.baseRates.map(rate => rate.minNights));
  if (nightsBetween(checkIn, checkOut) < minNights) return {code: "MIN_NIGHTS", minNights};
  return {code: "CONDITIONS"};
}
