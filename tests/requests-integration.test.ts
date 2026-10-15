import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { db } from "../src/lib/db.ts";
import { dateKey, todayInMoscow } from "../src/lib/dates.ts";
import { POST as submit } from "../src/app/api/requests/route.ts";
import { PATCH as updateStatus } from "../src/app/api/admin/requests/[id]/route.ts";
import { GET as listRequests } from "../src/app/api/admin/requests/route.ts";
import { GET as availability } from "../src/app/api/availability/route.ts";
import { deliverTelegramNotification } from "../src/lib/telegram.ts";
import { createAdminSession, revokeAdminSession, SESSION_COOKIE } from "../src/lib/auth.ts";
import { changeCalendar } from "../src/lib/admin-mutations.ts";
import { POST as retryTelegram } from "../src/app/api/internal/telegram/retry/route.ts";

process.env.SESSION_SECRET = "synthetic-test-secret-with-more-than-32-characters";
process.env.ADMIN_EMAIL = "requests-admin@example.invalid";
process.env.ADMIN_PASSWORD_HASH = `scrypt:test:${"0".repeat(128)}`;
process.env.TILDA_ORIGIN = "https://domkazan116.ru";
process.env.PRIVACY_POLICY_URL = "https://example.invalid/privacy";
process.env.TRUSTED_PROXY_SECRET = "synthetic-proxy-secret-with-more-than-32-characters";

const day = (offset: number) => new Date(todayInMoscow().getTime() + offset * 86_400_000);
const key = (offset: number) => dateKey(day(offset));
const body = (houseId: string, overrides: Record<string, unknown> = {}) => ({
  houseId, checkIn: key(7), checkOut: key(9), guestCount: 2, clientName: "Synthetic Guest",
  clientPhone: `+7000${Math.floor(Math.random() * 10_000_000).toString().padStart(7, "0")}`, messenger: null, messengerContact: null, comment: "Synthetic test only",
  consent: true, privacyPolicyUrl: process.env.PRIVACY_POLICY_URL, idempotencyKey: randomUUID(), website: "", ...overrides,
});
const request = (payload: unknown) => new NextRequest("http://localhost:3000/api/requests", {
  method: "POST", headers: { origin: "https://domkazan116.ru", "Content-Type": "application/json",
    "x-domkazan-client-ip": `2001:db8::${randomUUID().slice(0, 4)}`,
    "x-domkazan-proxy-secret": process.env.TRUSTED_PROXY_SECRET! }, body: JSON.stringify(payload),
});
async function withHouse(run: (houseId: string, slug: string) => Promise<void>) {
  const slug = `request-test-${randomUUID()}`;
  const house = await db.house.create({ data: { slug, name: "Synthetic House", maxGuests: 4 } });
  await db.baseRate.create({ data: { houseId: house.id, startsOn: day(0), endsOn: day(40),
    weekdayPrice: "1000", fridayPrice: "2000", saturdayPrice: "3000", sundayPrice: "1500", minNights: 1 } });
  try { await run(house.id, slug); }
  finally {
    await db.bookingRequest.deleteMany({ where: { houseId: house.id } });
    await db.house.delete({ where: { id: house.id } });
  }
}
async function statusRequest(id: string, status: string, token?: string, acknowledged = false) {
  return updateStatus(new NextRequest(`http://localhost:3000/api/admin/requests/${id}`, {
    method: "PATCH", headers: { origin: "http://localhost:3000", "Content-Type": "application/json",
      ...(token && { cookie: `${SESSION_COOKIE}=${token}` }) },
    body: JSON.stringify({ status, paymentAcknowledged: acknowledged }),
  }), { params: Promise.resolve({ id }) });
}
async function publicAvailable(slug: string) {
  const response = await availability(new NextRequest(`http://localhost:3000/api/availability?checkIn=${key(7)}&checkOut=${key(9)}&guests=2`));
  assert.equal(response.status, 200);
  return (await response.json()).houses.some((house: { slug: string }) => house.slug === slug);
}

after(async () => { await db.$disconnect(); });

test("public request uses server price, does not block dates, and repeats idempotently", async () => {
  await withHouse(async (houseId, slug) => {
    const payload = body(houseId, { quotedTotal: "0" });
    assert.equal((await submit(request(payload))).status, 400);
    const valid = body(houseId);
    const search = await availability(new NextRequest(`http://localhost:3000/api/availability?checkIn=${valid.checkIn}&checkOut=${valid.checkOut}&guests=2`));
    const serverQuote = (await search.json()).houses.find((house: { id: string }) => house.id === houseId).quote.total;
    const response = await submit(request(valid));
    assert.equal(response.status, 201);
    const result = await response.json();
    assert.equal(result.total, serverQuote);
    assert.equal(Number(result.total), Number((await db.bookingRequest.findUniqueOrThrow({ where: { id: result.requestId } })).quotedTotal));
    assert.equal(JSON.stringify(result).includes(valid.clientPhone), false);
    assert.equal(await publicAvailable(slug), true);
    assert.equal((await submit(request(valid))).status, 200);
    assert.equal(await db.bookingRequest.count({ where: { houseId } }), 1);
    const blocked = await db.blockedPeriod.create({ data: { houseId, startsOn: day(7), endsOn: day(9) } });
    assert.equal((await submit(request(body(houseId)))).status, 409);
    await db.blockedPeriod.delete({ where: { id: blocked.id } });
  });
});

test("confirmation requires admin and manual payment, prevents overlap and calendar reopening", async () => {
  await withHouse(async (houseId, slug) => {
    const firstResponse = await submit(request(body(houseId)));
    const secondResponse = await submit(request(body(houseId)));
    assert.equal(firstResponse.status, 201);
    assert.equal(secondResponse.status, 201);
    const first = await firstResponse.json();
    const second = await secondResponse.json();
    assert.equal((await statusRequest(first.requestId, "CONFIRMED")).status, 401);
    const anonymousList = await listRequests(new NextRequest("http://localhost:3000/api/admin/requests"));
    assert.equal(anonymousList.status, 401);
    const token = await createAdminSession(process.env.ADMIN_EMAIL!);
    try {
      assert.equal((await statusRequest(first.requestId, "CONFIRMED", token)).status, 400);
      const confirmed = await Promise.all([
        statusRequest(first.requestId, "CONFIRMED", token, true),
        statusRequest(second.requestId, "CONFIRMED", token, true),
      ]);
      assert.deepEqual(confirmed.map((item) => item.status).sort(), [200, 409],
        JSON.stringify(await Promise.all(confirmed.map((item) => item.clone().json()))));
      assert.equal(await db.bookingRequest.count({ where: { houseId, status: "CONFIRMED" } }), 1);
      assert.equal(await publicAvailable(slug), false);
      const revision = (await db.house.findUniqueOrThrow({ where: { id: houseId } })).revision;
      await changeCalendar({ action: "open", houseId, revision, start: key(7), end: key(8) });
      assert.equal(await publicAvailable(slug), false);
    } finally { await revokeAdminSession(token); }
  });
});

test("Telegram failure is retried without another booking request", async () => {
  await withHouse(async (houseId) => {
    process.env.TELEGRAM_BOT_TOKEN = "synthetic-token";
    process.env.TELEGRAM_CHAT_ID = "123";
    const originalFetch = globalThis.fetch;
    let attempts = 0;
    globalThis.fetch = async () => {
      attempts++;
      return new Response(JSON.stringify({ ok: attempts > 1 }), { status: attempts > 1 ? 200 : 502,
        headers: { "Content-Type": "application/json" } });
    };
    try {
      const response = await submit(request(body(houseId)));
      assert.equal(response.status, 201);
      const id = (await response.json()).requestId;
      const notification = await db.telegramNotification.findUniqueOrThrow({ where: { bookingRequestId: id } });
      assert.equal(notification.status, "PENDING");
      assert.equal(await deliverTelegramNotification(notification.id, new Date(Date.now() + 60_000)), true);
      assert.equal((await db.telegramNotification.findUniqueOrThrow({ where: { id: notification.id } })).status, "SENT");
      assert.equal(await db.bookingRequest.count({ where: { houseId } }), 1);
      assert.equal(attempts, 2);
    } finally { globalThis.fetch = originalFetch; delete process.env.TELEGRAM_BOT_TOKEN; delete process.env.TELEGRAM_CHAT_ID; }
  });
});

test("public form throttles repeated submissions and rejects an unrelated Origin", async () => {
  await withHouse(async (houseId) => {
    const first = body(houseId);
    for (let attempt = 0; attempt < 5; attempt++) {
      const response = await submit(request({ ...first, idempotencyKey: randomUUID() }));
      assert.equal(response.status, 201);
    }
    assert.equal((await submit(request({ ...first, idempotencyKey: randomUUID() }))).status, 429);
    assert.equal(await db.bookingRequest.count({ where: { houseId } }), 5);
    const foreign = await submit(new NextRequest("http://localhost:3000/api/requests", {
      method: "POST", headers: { origin: "https://not-domkazan.example.invalid", "Content-Type": "application/json" },
      body: JSON.stringify(body(houseId)),
    }));
    assert.equal(foreign.status, 403);
  });
});

test("server requires the configured privacy policy and preserves its URL with consent", async () => {
  await withHouse(async (houseId) => {
    const original = process.env.PRIVACY_POLICY_URL;
    delete process.env.PRIVACY_POLICY_URL;
    const input = body(houseId, { privacyPolicyUrl: original });
    assert.equal((await submit(request(input))).status, 503);
    process.env.PRIVACY_POLICY_URL = original;
    assert.equal((await submit(request({ ...input, privacyPolicyUrl: "https://other.example.invalid/privacy" }))).status, 400);
    const response = await submit(request(input));
    assert.equal(response.status, 201);
    const booking = await db.bookingRequest.findUniqueOrThrow({ where: { id: (await response.json()).requestId } });
    assert.equal(booking.consentPolicyUrl, original);
    assert.ok(booking.consentAt);
  });
});

test("overlapping Telegram handlers claim a notification once and retry endpoint needs a secret", async () => {
  const denied = await retryTelegram(new NextRequest("http://localhost/api/internal/telegram/retry", { method: "POST" }));
  assert.equal(denied.status, 401);
  await withHouse(async (houseId) => {
    const response = await submit(request(body(houseId)));
    assert.equal(response.status, 201);
    const id = (await response.json()).requestId;
    const notification = await db.telegramNotification.findUniqueOrThrow({ where: { bookingRequestId: id } });
    const originalFetch = globalThis.fetch;
    process.env.TELEGRAM_BOT_TOKEN = "synthetic-token"; process.env.TELEGRAM_CHAT_ID = "123";
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      await new Promise((resolve) => setTimeout(resolve, 50));
      return Response.json({ ok: true });
    };
    try {
      const results = await Promise.all([deliverTelegramNotification(notification.id), deliverTelegramNotification(notification.id)]);
      assert.equal(results.filter(Boolean).length, 1);
      assert.equal(calls, 1);
    } finally { globalThis.fetch = originalFetch; delete process.env.TELEGRAM_BOT_TOKEN; delete process.env.TELEGRAM_CHAT_ID; }
  });
});
