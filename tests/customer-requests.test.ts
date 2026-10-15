import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { dateKey, todayInMoscow } from "../src/lib/dates.ts";
import { validateCustomerRequest, CustomerRequestError } from "../src/lib/customer-request-validation.ts";
import { contactOptions } from "../src/lib/contact-options.ts";

const tomorrow = dateKey(new Date(todayInMoscow().getTime() + 86_400_000));
const next = dateKey(new Date(todayInMoscow().getTime() + 2 * 86_400_000));
const valid = () => ({ houseId: "house-1", checkIn: tomorrow, checkOut: next, guestCount: 2,
  clientName: "Synthetic Guest", clientPhone: "+70000000000", consent: true as const,
  privacyPolicyUrl: "https://example.invalid/privacy", idempotencyKey: randomUUID() });

test("public application requires consent and a valid date interval", () => {
  assert.equal(validateCustomerRequest(valid()).guestCount, 2);
  assert.throws(() => validateCustomerRequest({ ...valid(), consent: false }), CustomerRequestError);
  assert.throws(() => validateCustomerRequest({ ...valid(), checkOut: tomorrow }), CustomerRequestError);
  assert.throws(() => validateCustomerRequest({ ...valid(), clientPhone: "abc" }), CustomerRequestError);
  assert.throws(() => validateCustomerRequest({ ...valid(), clientPhone: "----------" }), CustomerRequestError);
  assert.throws(() => validateCustomerRequest({ ...valid(), quotedTotal: "0.01" }), CustomerRequestError);
  assert.throws(() => validateCustomerRequest({ ...valid(), messenger: "TELEGRAM" }), CustomerRequestError);
});

test("owner contact links are built only from valid configuration", () => {
  process.env.PUBLIC_OWNER_PHONE = "+7 (000) 000-00-00";
  process.env.PUBLIC_OWNER_TELEGRAM = "@example_owner";
  process.env.PUBLIC_OWNER_WHATSAPP = "+7 (000) 000-00-00";
  assert.deepEqual(contactOptions(), { phone: "tel:+70000000000", telegram: "https://t.me/example_owner",
    whatsapp: "https://wa.me/70000000000" });
  process.env.PUBLIC_OWNER_TELEGRAM = "javascript:evil";
  assert.equal(contactOptions().telegram, null);
  delete process.env.PUBLIC_OWNER_PHONE; delete process.env.PUBLIC_OWNER_TELEGRAM; delete process.env.PUBLIC_OWNER_WHATSAPP;
});
