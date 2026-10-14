import { dateKey, eachNight, nightsBetween } from "./dates.ts";

type Money = string | { toString(): string };

export type RateInput = {
  startsOn: Date;
  endsOn: Date;
  pricePerNight: Money;
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

// An override changes one night. A valid base rate must still cover every night.
export function quoteStay(
  checkIn: Date,
  checkOut: Date,
  baseRates: RateInput[],
  overrides: OverrideInput[],
): PriceQuote | null {
  const nights = nightsBetween(checkIn, checkOut);
  if (nights < 1) return null;

  const overrideByDate = new Map(overrides.map((item) => [dateKey(item.date), item]));
  let total = 0n;

  for (const night of eachNight(checkIn, checkOut)) {
    // Overlapping tariffs are invalid data; latest start wins until admin validation is added.
    const base = baseRates
      .filter((rate) => rate.startsOn <= night && night < rate.endsOn)
      .sort((a, b) => b.startsOn.getTime() - a.startsOn.getTime())[0];
    if (!base || nights < base.minNights) return null;
    total += toCents(overrideByDate.get(dateKey(night))?.pricePerNight ?? base.pricePerNight);
  }

  return { nights, total: fromCents(total), currency: "RUB" };
}
