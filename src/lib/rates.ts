import { intervalsOverlap } from "./dates.ts";

export type RatePeriod = { startsOn: Date; endsOn: Date };

export class RateConflictError extends Error {
  constructor() { super("Периоды базовых тарифов одного дома пересекаются."); }
}

export function assertValidRatePeriod(candidate: RatePeriod, existing: RatePeriod[]): void {
  if (candidate.startsOn >= candidate.endsOn) throw new Error("Дата окончания тарифа должна быть позже даты начала.");
  if (existing.some((rate) => intervalsOverlap(candidate.startsOn, candidate.endsOn, rate.startsOn, rate.endsOn))) {
    throw new RateConflictError();
  }
}

export function assertNonOverlappingRates(rates: RatePeriod[]): void {
  for (let index = 0; index < rates.length; index++) {
    assertValidRatePeriod(rates[index], rates.slice(0, index));
  }
}
