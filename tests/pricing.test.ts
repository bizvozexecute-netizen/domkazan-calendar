import test from "node:test";
import assert from "node:assert/strict";
import { parseDateOnly } from "../src/lib/dates.ts";
import { quoteStay } from "../src/lib/pricing.ts";

function date(value: string): Date { return parseDateOnly(value)!; }

test("base tariff plus nightly exception uses exact kopecks", () => {
  const quote = quoteStay(
    date("2026-11-01"), date("2026-11-04"),
    [{ startsOn: date("2026-01-01"), endsOn: date("2027-01-01"), pricePerNight: "12500.50", minNights: 2 }],
    [{ date: date("2026-11-02"), pricePerNight: "16000.00" }],
  );
  assert.deepEqual(quote, { nights: 3, total: "41001.00", currency: "RUB" });
});

test("missing tariff or unmet minimum returns no quote", () => {
  const rate = [{ startsOn: date("2026-11-01"), endsOn: date("2026-11-03"), pricePerNight: "10000", minNights: 2 }];
  assert.equal(quoteStay(date("2026-11-01"), date("2026-11-02"), rate, []), null);
  assert.equal(quoteStay(date("2026-11-01"), date("2026-11-04"), rate, []), null);
});
