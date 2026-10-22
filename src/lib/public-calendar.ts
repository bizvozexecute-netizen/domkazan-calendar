import { db } from "./db";
import { eachNight, dateKey, todayInMoscow } from "./dates";
import { monthBounds } from "./calendar-board";
import { priceForNight } from "./pricing";
import { publicHouseIdentity } from "./public-house-identity";

// A public DTO contains no reservation IDs, reasons, contacts or customer data.
export async function getPublicHouseCalendar(slug: string, month: string) {
  const first = monthBounds(month);
  if (!first) return null;
  const end = new Date(first.end);
  end.setUTCMonth(end.getUTCMonth() + 1);
  const house = await db.house.findFirst({ where: { ...publicHouseIdentity(slug), isActive: true }, select: {
    id: true, name: true, slug: true, maxGuests: true,
    baseRates: { where: { startsOn: { lt: end }, endsOn: { gt: first.start } } },
    dateOverrides: { where: { date: { gte: first.start, lt: end } } },
    blockedPeriods: { where: { startsOn: { lt: end }, endsOn: { gt: first.start } }, select: { startsOn: true, endsOn: true } },
    bookingRequests: { where: { status: "CONFIRMED", checkIn: { lt: end }, checkOut: { gt: first.start } }, select: { checkIn: true, checkOut: true } },
  } });
  if (!house) return null;
  const today = todayInMoscow();
  const overrides = new Map(house.dateOverrides.map((item) => [dateKey(item.date), item.pricePerNight]));
  return { house: { id: house.id, slug: house.slug, name: house.name, maxGuests: house.maxGuests }, month,
    days: eachNight(first.start, end).map((date) => {
      const rate = house.baseRates.find((item) => item.startsOn <= date && date < item.endsOn);
      const price = overrides.get(dateKey(date)) ?? (rate ? priceForNight(rate, date) : null);
      const occupied = house.blockedPeriods.some((item) => item.startsOn <= date && date < item.endsOn) ||
        house.bookingRequests.some((item) => item.checkIn <= date && date < item.checkOut);
      return { date: dateKey(date), price: price?.toString() ?? null, minNights: rate?.minNights ?? 1,
        status: date < today ? "past" : occupied ? "occupied" : price === null ? "unpriced" : "available" };
    }),
  };
}
