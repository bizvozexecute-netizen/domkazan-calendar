import { db } from "./db";
import { dateKey, eachNight } from "./dates";
import { priceForNight } from "./pricing";

export function monthBounds(value: string): { start: Date; end: Date; dates: string[] } | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null;
  const [year, month] = value.split("-").map(Number);
  if (year < 2000 || year > 2100) return null;
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start, end, dates: eachNight(start, end).map(dateKey) };
}

export async function getCalendarBoard(month: string) {
  const bounds = monthBounds(month);
  if (!bounds) return null;
  const houses = await db.house.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, slug: true, calendarName: true, isActive: true, revision: true,
      baseRates: { where: { startsOn: { lt: bounds.end }, endsOn: { gt: bounds.start } } },
      dateOverrides: { where: { date: { gte: bounds.start, lt: bounds.end } } },
      blockedPeriods: { where: { startsOn: { lt: bounds.end }, endsOn: { gt: bounds.start } } },
      bookingRequests: { where: { status: "CONFIRMED", checkIn: { lt: bounds.end }, checkOut: { gt: bounds.start } },
        select: { checkIn: true, checkOut: true } },
    },
  });
  return {
    month,
    dates: bounds.dates,
    houses: houses.map((house) => ({
      id: house.id, name: house.name, slug: house.slug, calendarName: house.calendarName, isActive: house.isActive, revision: house.revision,
      cells: bounds.dates.map((key) => {
        const day = new Date(`${key}T00:00:00.000Z`);
        const manual = house.dateOverrides.find((item) => dateKey(item.date) === key);
        const base = house.baseRates.find((item) => item.startsOn <= day && day < item.endsOn);
        const price = manual?.pricePerNight ?? (base ? priceForNight(base, day) : null);
        const booked = house.bookingRequests.some((item) => item.checkIn <= day && day < item.checkOut);
        const closed = house.blockedPeriods.some((item) => item.startsOn <= day && day < item.endsOn);
        return { date: key, price: price?.toString() ?? null, source: manual ? "manual" : base ? "base" : "none",
          status: booked ? "booked" : closed ? "closed" : "free" };
      }),
    })),
  };
}

export type CalendarBoardData = NonNullable<Awaited<ReturnType<typeof getCalendarBoard>>>;
