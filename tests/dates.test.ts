import test from "node:test";
import assert from "node:assert/strict";
import { intervalsOverlap, nightsBetween, parseDateOnly } from "../src/lib/dates.ts";

function date(value: string): Date { return parseDateOnly(value)!; }

test("adjacent stays do not overlap at checkout", () => {
  assert.equal(intervalsOverlap(date("2026-10-14"), date("2026-10-17"), date("2026-10-17"), date("2026-10-20")), false);
  assert.equal(intervalsOverlap(date("2026-10-14"), date("2026-10-17"), date("2026-10-16"), date("2026-10-20")), true);
});

test("night count and strict calendar dates", () => {
  assert.equal(nightsBetween(date("2028-02-28"), date("2028-03-01")), 2);
  assert.equal(parseDateOnly("2026-02-29"), null);
  assert.equal(parseDateOnly("2026-13-01"), null);
});
