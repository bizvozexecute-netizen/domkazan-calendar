import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes, scryptSync } from "node:crypto";
import { db } from "../src/lib/db.ts";
import { findAvailableHouses } from "../src/lib/availability.ts";
import { parseDateOnly } from "../src/lib/dates.ts";
import { NextRequest } from "next/server";

const date = (value: string) => parseDateOnly(value)!;
const slug = `integration-${randomBytes(8).toString("hex")}`;
let houseId: string;

before(async () => {
  const salt = randomBytes(16).toString("hex");
  process.env.SESSION_SECRET = `integration-test-${randomBytes(32).toString("hex")}`;
  process.env.ADMIN_EMAIL = "admin@example.invalid";
  process.env.ADMIN_PASSWORD_HASH = `scrypt:${salt}:${scryptSync("test-only-password", salt, 64).toString("hex")}`;
  const house = await db.house.create({ data: {
    slug, name: "Integration test house", maxGuests: 6, district: "Тестовый район",
    bedrooms: 2, bathrooms: 1, amenities: ["sauna", "wifi"], petsAllowed: true,
  } });
  houseId = house.id;
  await db.baseRate.create({ data: {
    houseId, startsOn: date("2026-01-01"), endsOn: date("2027-01-01"),
    weekdayPrice: "1000.00", fridayPrice: "2000.00", saturdayPrice: "3000.00", sundayPrice: "1500.00", minNights: 1,
  } });
  await db.dateOverride.create({ data: { houseId, date: date("2026-11-07"), pricePerNight: "4000.00" } });
});

after(async () => {
  if (houseId) {
    await db.bookingRequest.deleteMany({ where: { houseId } });
    await db.house.delete({ where: { id: houseId } });
  }
  await db.$disconnect();
});

test("migrations create the exclusion constraint", async () => {
  const rows = await db.$queryRaw<{ conname: string }[]>`
    SELECT conname FROM pg_constraint WHERE conname = 'BaseRate_no_overlap'
  `;
  assert.equal(rows.length, 1);
});

test("PostgreSQL rejects overlapping tariffs but accepts adjacent periods", async () => {
  await assert.rejects(db.baseRate.create({ data: {
    houseId, startsOn: date("2026-12-01"), endsOn: date("2027-02-01"),
    weekdayPrice: "1", fridayPrice: "1", saturdayPrice: "1", sundayPrice: "1",
  } }));
  const adjacent = await db.baseRate.create({ data: {
    houseId, startsOn: date("2027-01-01"), endsOn: date("2027-02-01"),
    weekdayPrice: "1", fridayPrice: "1", saturdayPrice: "1", sundayPrice: "1",
  } });
  assert.ok(adjacent.id);
});

test("availability filters characteristics and totals four daily rates with override", async () => {
  const found = await findAvailableHouses(date("2026-11-02"), date("2026-11-09"), {
    guests: 4, district: "тестовый район", bedrooms: 2, amenities: ["sauna"], petsAllowed: true,
  });
  const house = found.find((item) => item.slug === slug);
  assert.equal(house?.quote.total, "11500.00");
  const missing = await findAvailableHouses(date("2026-11-02"), date("2026-11-09"), { guests: 7 });
  assert.equal(missing.some((item) => item.slug === slug), false);
});

test("blocked and confirmed periods exclude nights, checkout boundary stays free", async () => {
  await db.blockedPeriod.create({ data: { houseId, startsOn: date("2026-11-15"), endsOn: date("2026-11-17") } });
  await db.bookingRequest.create({ data: {
    houseId, checkIn: date("2026-11-10"), checkOut: date("2026-11-12"), guestCount: 2,
    clientName: "Synthetic test", status: "CONFIRMED",
  } });
  const search = (start: string, end: string) => findAvailableHouses(date(start), date(end), { guests: 2 });
  assert.equal((await search("2026-11-10", "2026-11-11")).some((item) => item.slug === slug), false);
  assert.equal((await search("2026-11-12", "2026-11-13")).some((item) => item.slug === slug), true);
  assert.equal((await search("2026-11-16", "2026-11-17")).some((item) => item.slug === slug), false);
});

test("admin sessions are revocable and login attempts are throttled", async () => {
  const { allowLoginAttempt, createAdminSession, getAdminSessionFromToken, revokeAdminSession } = await import("../src/lib/auth.ts");
  const { checkAdminApiAccess } = await import("../src/lib/admin-api.ts");
  const anonymous = new NextRequest("http://localhost:3000/api/admin/houses/test/rates");
  assert.equal((await checkAdminApiAccess(anonymous))?.status, 401);
  const token = await createAdminSession("admin@example.invalid");
  assert.deepEqual(await getAdminSessionFromToken(token), { email: "admin@example.invalid" });
  const wrongOrigin = new NextRequest("http://localhost:3000/api/admin/houses/test/rates", {
    method: "POST", headers: { cookie: `domkazan_admin_session=${token}`, origin: "https://invalid.example" },
  });
  assert.equal((await checkAdminApiAccess(wrongOrigin))?.status, 403);
  const allowed = new NextRequest("http://localhost:3000/api/admin/houses/test/rates", {
    method: "POST", headers: { cookie: `domkazan_admin_session=${token}`, origin: "http://localhost:3000" },
  });
  assert.equal(await checkAdminApiAccess(allowed), null);
  await revokeAdminSession(token);
  assert.equal(await getAdminSessionFromToken(token), null);
  for (let attempt = 0; attempt < 5; attempt++) assert.equal(await allowLoginAttempt(), true);
  assert.equal(await allowLoginAttempt(), false);
});

test("phone and desktop sessions coexist; logout and expiry affect only the matching session", async () => {
  const { createAdminSession, getAdminSessionFromToken, revokeAdminSession } = await import("../src/lib/auth.ts");
  const desktop = await createAdminSession("admin@example.invalid");
  const phone = await createAdminSession("admin@example.invalid");
  try {
    assert.deepEqual(await getAdminSessionFromToken(desktop), { email: "admin@example.invalid" });
    assert.deepEqual(await getAdminSessionFromToken(phone), { email: "admin@example.invalid" });
    await revokeAdminSession(desktop);
    assert.equal(await getAdminSessionFromToken(desktop), null);
    assert.deepEqual(await getAdminSessionFromToken(phone), { email: "admin@example.invalid" });
    await db.adminSession.update({ where: { tokenHash: createHash("sha256").update(phone).digest("hex") }, data: { expiresAt: new Date(Date.now()-1000) } });
    assert.equal(await getAdminSessionFromToken(phone), null);
  } finally { await revokeAdminSession(desktop); await revokeAdminSession(phone); }
});

test("concurrent logins retain at most five sessions and a password change invalidates every old token", async () => {
  const { createAdminSession, getAdminSessionFromToken, revokeAdminSession } = await import("../src/lib/auth.ts");
  const email = "admin@example.invalid";
  const previousHash = process.env.ADMIN_PASSWORD_HASH;
  await db.adminSession.deleteMany({ where: { email } });
  const tokens = await Promise.all(Array.from({length:7},()=>createAdminSession(email)));
  let replacement: string | undefined;
  try {
    assert.equal((await Promise.all(tokens.map(getAdminSessionFromToken))).filter(Boolean).length, 5);
    assert.equal(await db.adminSession.count({ where: { email } }), 5);
    const salt = randomBytes(16).toString("hex");
    process.env.ADMIN_PASSWORD_HASH = `scrypt:${salt}:${scryptSync("replacement-test-only", salt, 64).toString("hex")}`;
    assert.ok((await Promise.all(tokens.map(getAdminSessionFromToken))).every(session=>session===null));
    replacement = await createAdminSession(email);
    assert.deepEqual(await getAdminSessionFromToken(replacement), { email });
    assert.equal(await db.adminSession.count({ where: { email } }), 1);
  } finally {
    process.env.ADMIN_PASSWORD_HASH = previousHash;
    for (const token of tokens) await revokeAdminSession(token);
    if (replacement) await revokeAdminSession(replacement);
  }
});
