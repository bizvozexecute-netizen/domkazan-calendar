import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { db } from "../src/lib/db.ts";
import { createHouse, updateHouse, saveRate, deleteRate, changeCalendar, AdminConflictError } from "../src/lib/admin-mutations.ts";
import { dateKey, todayInMoscow } from "../src/lib/dates.ts";
import { getCalendarBoard } from "../src/lib/calendar-board.ts";
import { GET as publicSearch } from "../src/app/api/availability/route.ts";
import { POST as calendarPost } from "../src/app/api/admin/calendar/route.ts";
import { POST as housePost } from "../src/app/api/admin/houses/route.ts";
import { PATCH as housePatch } from "../src/app/api/admin/houses/[houseId]/route.ts";
import { POST as ratePost } from "../src/app/api/admin/houses/[houseId]/rates/route.ts";
import { PATCH as ratePatch, DELETE as rateDelete } from "../src/app/api/admin/houses/[houseId]/rates/[rateId]/route.ts";
import { createAdminSession, revokeAdminSession, SESSION_COOKIE } from "../src/lib/auth.ts";

const day = (offset: number) => new Date(todayInMoscow().getTime() + offset * 86_400_000);
const key = (offset: number) => dateKey(day(offset));
const uniqueSlug = () => `admin-test-${randomBytes(7).toString("hex")}`;
const fields = () => ({ name: "Synthetic admin house", slug: uniqueSlug(), tildaUrl: null, maxGuests: 4,
  district: "Test", bedrooms: 2, bathrooms: 1, amenities: ["wifi"], petsAllowed: false, isActive: true });
const prices = (weekdayPrice = "1000.00") => ({ startsOn: key(0), endsOn: key(40), weekdayPrice,
  fridayPrice: "2000.00", saturdayPrice: "3000.00", sundayPrice: "1500.00", minNights: 1 });

async function withHouse(run: (houseId: string, slug: string) => Promise<void>) {
  const house = await createHouse(fields());
  try { await run(house.id, house.slug); }
  finally { await db.house.delete({ where: { id: house.id } }); }
}

async function available(slug: string, startOffset: number, endOffset: number) {
  const request = new NextRequest(`http://localhost:3000/api/availability?checkIn=${key(startOffset)}&checkOut=${key(endOffset)}&guests=2`);
  const response = await publicSearch(request);
  assert.equal(response.status, 200);
  const body = await response.json();
  return body.houses.find((house: { slug: string }) => house.slug === slug);
}

after(async () => { await db.$disconnect(); });

test("house edits use optimistic concurrency and keep slugs unique", async () => {
  await withHouse(async (id) => {
    const original = fields();
    const saved = await updateHouse(id, 0, { ...original, slug: `edited-${uniqueSlug()}`, name: "Changed" });
    assert.equal(saved.revision, 1);
    await assert.rejects(createHouse({ ...fields(), slug: saved.slug }), AdminConflictError);
    await assert.rejects(updateHouse(id, 0, { ...original, name: "Stale edit" }), AdminConflictError);
    assert.equal((await db.house.findUniqueOrThrow({ where: { id } })).name, "Changed");
  });
});

test("tariff edits reject overlap and preserve manual prices", async () => {
  await withHouse(async (id, slug) => {
    const created = await saveRate(id, 0, prices());
    assert.equal(created.revision, 1);
    const manualRevision = await changeCalendar({ action: "setPrice", houseId: id, revision: 1,
      start: key(10), end: key(11), price: "4200.00" });
    assert.equal(manualRevision, 2);
    const changed = await saveRate(id, 2, prices("1800.00"), created.rate.id);
    assert.equal(changed.revision, 3);
    assert.equal((await available(slug, 10, 11))?.quote.total, "4200.00");
    await assert.rejects(saveRate(id, 3, { ...prices(), startsOn: key(5), endsOn: key(15) }), AdminConflictError);
    assert.equal((await db.house.findUniqueOrThrow({ where: { id } })).revision, 3);
    await assert.rejects(saveRate(id, 2, prices("1900.00"), created.rate.id), AdminConflictError);
    assert.equal(await deleteRate(id, created.rate.id, 3), 4);
    assert.equal((await db.dateOverride.findMany({ where: { houseId: id } })).length, 1);
    assert.equal((await available(slug, 10, 11))?.quote.total, "4200.00");
    assert.equal(await available(slug, 11, 12), undefined);
  });
});

test("closing and reopening dates updates the board and public availability", async () => {
  await withHouse(async (id, slug) => {
    await saveRate(id, 0, prices());
    const month = key(10).slice(0, 7);
    assert.equal((await available(slug, 10, 11))?.slug, slug);
    assert.equal(await changeCalendar({ action: "close", houseId: id, revision: 1, start: key(10), end: key(13) }), 2);
    assert.equal(await available(slug, 10, 11), undefined);
    const closed = await getCalendarBoard(month);
    const row = closed?.houses.find((house) => house.id === id);
    assert.equal(row?.cells.find((cell) => cell.date === key(10))?.status, "closed");
    await assert.rejects(db.blockedPeriod.create({ data: { houseId: id, startsOn: day(11), endsOn: day(12) } }));
    assert.equal(await changeCalendar({ action: "open", houseId: id, revision: 2, start: key(11), end: key(12) }), 3);
    assert.equal(await available(slug, 10, 11), undefined);
    assert.equal((await available(slug, 11, 12))?.slug, slug);
    assert.equal(await changeCalendar({ action: "setPrice", houseId: id, revision: 3,
      start: key(11), end: key(12), price: "7777.00" }), 4);
    assert.equal((await available(slug, 11, 12))?.quote.total, "7777.00");
    assert.equal(await changeCalendar({ action: "clearPrice", houseId: id, revision: 4, start: key(11), end: key(12) }), 5);
    assert.notEqual((await available(slug, 11, 12))?.quote.total, "7777.00");
    await assert.rejects(changeCalendar({ action: "close", houseId: id, revision: 4, start: key(14), end: key(15) }), AdminConflictError);
  });
});

test("every admin write route rejects anonymous requests", async () => {
  const request = (path: string, method: string) => new NextRequest(`http://localhost:3000${path}`, { method,
    headers: { origin: "http://localhost:3000", "Content-Type": "application/json" }, body: "{}" });
  const houseContext = { params: Promise.resolve({ houseId: "missing" }) };
  const rateContext = { params: Promise.resolve({ houseId: "missing", rateId: "missing" }) };
  const responses = await Promise.all([
    calendarPost(request("/api/admin/calendar", "POST")),
    housePost(request("/api/admin/houses", "POST")),
    housePatch(request("/api/admin/houses/missing", "PATCH"), houseContext),
    ratePost(request("/api/admin/houses/missing/rates", "POST"), houseContext),
    ratePatch(request("/api/admin/houses/missing/rates/missing", "PATCH"), rateContext),
    rateDelete(request("/api/admin/houses/missing/rates/missing", "DELETE"), rateContext),
  ]);
  assert.deepEqual(responses.map((response) => response.status), [401, 401, 401, 401, 401, 401]);
});

test("authenticated admin API changes are visible in the public search", async () => {
  process.env.SESSION_SECRET = "synthetic-test-secret-with-more-than-32-characters";
  process.env.ADMIN_EMAIL = "admin-api@example.invalid";
  process.env.ADMIN_PASSWORD_HASH = `scrypt:test:${"0".repeat(128)}`;
  const token = await createAdminSession("admin-api@example.invalid");
  const request = (path: string, body: unknown) => new NextRequest(`http://localhost:3000${path}`, { method: "POST",
    headers: { origin: "http://localhost:3000", cookie: `${SESSION_COOKIE}=${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body) });
  let id: string | undefined;
  try {
    const houseResponse = await housePost(request("/api/admin/houses", fields()));
    assert.equal(houseResponse.status, 201);
    const house = await houseResponse.json();
    id = house.id;
    const rateResponse = await ratePost(request(`/api/admin/houses/${id}/rates`, { ...prices(), revision: 0 }),
      { params: Promise.resolve({ houseId: id! }) });
    assert.equal(rateResponse.status, 201);
    assert.equal((await available((await db.house.findUniqueOrThrow({ where: { id } })).slug, 10, 11))?.id, id);
    const closeResponse = await calendarPost(request("/api/admin/calendar", { action: "close", houseId: id,
      revision: 1, start: key(10), end: key(11) }));
    assert.equal(closeResponse.status, 200);
    assert.equal(await available((await db.house.findUniqueOrThrow({ where: { id } })).slug, 10, 11), undefined);
  } finally {
    await revokeAdminSession(token);
    if (id) await db.house.delete({ where: { id } });
  }
});
