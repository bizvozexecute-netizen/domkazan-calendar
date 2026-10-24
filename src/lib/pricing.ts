import { dateKey, eachNight, nightsBetween } from "./dates.ts";
import { assertNonOverlappingRates } from "./rates.ts";

type Money = string | { toString(): string };

export type RateInput = {
  startsOn: Date;
  endsOn: Date;
  weekdayPrice: Money;
  fridayPrice: Money;
  saturdayPrice: Money;
  sundayPrice: Money;
  minNights: number;
};

export type OverrideInput = {
  date: Date;
  pricePerNight: Money;
};

export type PriceQuote = {
  nights: number;
  total: string;
  currency: "RUB";
  accommodationTotal?: string;
  extraGuestTotal?: string;
  serviceFee?: string;
};

function toCents(value: Money): bigint {
  const text = value.toString();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new Error("Invalid price");
  const [whole, fraction = ""] = text.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
}

function fromCents(value: bigint): string {
  return `${value / 100n}.${(value % 100n).toString().padStart(2, "0")}`;
}

export function priceForNight(rate: RateInput, night: Date): Money {
  switch (night.getUTCDay()) {
    case 0: return rate.sundayPrice;
    case 5: return rate.fridayPrice;
    case 6: return rate.saturdayPrice;
    default: return rate.weekdayPrice;
  }
}

// A manual override takes precedence over the four prices in the period.
export function quoteStay(
  checkIn: Date,
  checkOut: Date,
  baseRates: RateInput[],
  overrides: OverrideInput[],
  charges?: { guests: number; includedGuests: number | null; extraGuestPrice: Money; serviceFee: Money },
): PriceQuote | null {
  const nights = nightsBetween(checkIn, checkOut);
  if (nights < 1) return null;
  assertNonOverlappingRates(baseRates);

  const overrideByDate = new Map(overrides.map((item) => [dateKey(item.date), item]));
  let total = 0n;

  for (const night of eachNight(checkIn, checkOut)) {
    const base = baseRates.find((rate) => rate.startsOn <= night && night < rate.endsOn);
    const override = overrideByDate.get(dateKey(night));
    if ((!base && !override) || (base && nights < base.minNights)) return null;
    total += toCents(override?.pricePerNight ?? priceForNight(base!, night));
  }

  const extraGuests = charges?.includedGuests == null ? 0 : Math.max(0, charges.guests - charges.includedGuests);
  const extraGuestTotal = charges ? BigInt(extraGuests * nights) * toCents(charges.extraGuestPrice) : 0n;
  const serviceFee = charges ? toCents(charges.serviceFee) : 0n;
  return { nights, total: fromCents(total + extraGuestTotal + serviceFee), currency: "RUB",
    ...(extraGuestTotal || serviceFee ? { accommodationTotal: fromCents(total),
      extraGuestTotal: fromCents(extraGuestTotal), serviceFee: fromCents(serviceFee) } : {}) };
}
