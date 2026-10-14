import test from "node:test";
import assert from "node:assert/strict";
import { parseDateOnly } from "../src/lib/dates.ts";
import { assertNonOverlappingRates, assertValidRatePeriod, RateConflictError } from "../src/lib/rates.ts";

const date = (value: string) => parseDateOnly(value)!;

test("overlapping base tariff periods are rejected", () => {
  const first = { startsOn: date("2026-11-01"), endsOn: date("2026-12-01") };
  assert.throws(() => assertValidRatePeriod({ startsOn: date("2026-11-30"), endsOn: date("2027-01-01") }, [first]), RateConflictError);
  assert.throws(() => assertNonOverlappingRates([first, { startsOn: date("2026-11-15"), endsOn: date("2026-11-20") }]), RateConflictError);
});

test("adjacent periods are valid; empty and reversed periods are rejected", () => {
  const first = { startsOn: date("2026-11-01"), endsOn: date("2026-12-01") };
  assert.doesNotThrow(() => assertValidRatePeriod({ startsOn: date("2026-12-01"), endsOn: date("2027-01-01") }, [first]));
  assert.throws(() => assertValidRatePeriod({ startsOn: date("2026-12-01"), endsOn: date("2026-12-01") }, []));
});
