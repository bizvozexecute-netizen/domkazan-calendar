import test from "node:test";
import assert from "node:assert/strict";
import { parseDateOnly } from "../src/lib/dates.ts";
import { priceForNight, quoteStay, type RateInput } from "../src/lib/pricing.ts";

const date = (value: string) => parseDateOnly(value)!;
const rate: RateInput = {
  startsOn: date("2026-01-01"), endsOn: date("2027-01-01"),
  weekdayPrice: "1000.00", fridayPrice: "2000.00", saturdayPrice: "3000.00", sundayPrice: "1500.00", minNights: 1,
};

test("Monday through Thursday, Friday, Saturday and Sunday use four rates", () => {
  assert.equal(priceForNight(rate, date("2026-11-02")), "1000.00");
  assert.equal(priceForNight(rate, date("2026-11-05")), "1000.00");
  assert.equal(priceForNight(rate, date("2026-11-06")), "2000.00");
  assert.equal(priceForNight(rate, date("2026-11-07")), "3000.00");
  assert.equal(priceForNight(rate, date("2026-11-08")), "1500.00");
});

test("manual date price takes priority and total keeps kopecks", () => {
  const quote = quoteStay(date("2026-11-02"), date("2026-11-09"), [rate], [
    { date: date("2026-11-07"), pricePerNight: "4000.50" },
  ]);
  assert.deepEqual(quote, { nights: 7, total: "11500.50", currency: "RUB" });
});

test("missing base rate can be covered by a manual date price", () => {
  assert.deepEqual(quoteStay(date("2026-11-02"), date("2026-11-03"), [], [
    { date: date("2026-11-02"), pricePerNight: "2500" },
  ]), { nights: 1, total: "2500.00", currency: "RUB" });
  assert.equal(quoteStay(date("2026-11-02"), date("2026-11-03"), [], []), null);
});

test("minimum stay and period boundary are enforced", () => {
  const minimum = { ...rate, minNights: 2 };
  assert.equal(quoteStay(date("2026-11-02"), date("2026-11-03"), [minimum], []), null);
  assert.equal(quoteStay(date("2027-01-01"), date("2027-01-02"), [rate], []), null);
});

test("additional guests are charged per night and the mandatory fee once", () => {
  const quote = quoteStay(date("2026-11-02"), date("2026-11-04"), [rate], [],
    { guests: 7, includedGuests: 5, extraGuestPrice: "200.25", serviceFee: "1500.50" });
  assert.deepEqual(quote, { nights: 2, total: "4301.50", currency: "RUB",
    accommodationTotal: "2000.00", extraGuestTotal: "801.00", serviceFee: "1500.50" });
  assert.equal(quoteStay(date("2026-11-02"), date("2026-11-04"), [rate], [],
    { guests: 3, includedGuests: 5, extraGuestPrice: "200", serviceFee: "0" })?.total, "2000.00");
});
