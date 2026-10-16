import test from "node:test";
import assert from "node:assert/strict";
import { appOrigin, clientIp, equalSecret, privacyPolicyUrl } from "../src/lib/request-security.ts";

test("proxy IP headers need a shared secret and a single valid address", () => {
  const secret = "synthetic-proxy-secret-with-more-than-32-characters";
  process.env.TRUSTED_PROXY_SECRET = secret;
  assert.equal(clientIp(new Headers({ "x-forwarded-for": "192.0.2.1", "x-real-ip": "192.0.2.1" })), "unknown");
  assert.equal(clientIp(new Headers({ "x-domkazan-client-ip": "192.0.2.1", "x-domkazan-proxy-secret": "wrong" })), "unknown");
  assert.equal(clientIp(new Headers({ "x-domkazan-client-ip": "192.0.2.1", "x-domkazan-proxy-secret": secret })), "192.0.2.1");
  assert.equal(clientIp(new Headers({ "x-domkazan-client-ip": "192.0.2.1, 192.0.2.2", "x-domkazan-proxy-secret": secret })), "unknown");
  assert.equal(equalSecret("я".repeat(32), "a".repeat(32)), false);
  delete process.env.TRUSTED_PROXY_SECRET;
});
test("canonical origin ignores browser proxy headers and policy requires HTTPS", () => {
  process.env.APP_ORIGIN = "https://calendar.example.invalid";
  assert.equal(appOrigin(new Request("http://evil.example.invalid", { headers: { "x-forwarded-host": "evil.example.invalid" } })), "https://calendar.example.invalid");
  process.env.PRIVACY_POLICY_URL = "http://example.invalid/privacy";
  assert.equal(privacyPolicyUrl(), null);
  process.env.PRIVACY_POLICY_URL = "https://example.invalid/privacy";
  assert.equal(privacyPolicyUrl(), "https://example.invalid/privacy");
  delete process.env.APP_ORIGIN; delete process.env.PRIVACY_POLICY_URL;
});
test("Vercel preview uses its deployment URL only for the synthetic test stand", () => {
  process.env.VERCEL_ENV = "preview";
  process.env.VERCEL_URL = "domkazan-calendar-test-abc123.vercel.app";
  process.env.TEST_CATALOG_ENABLED = "true";
  const request = new Request("https://evil.example.invalid");
  assert.equal(appOrigin(request), "https://domkazan-calendar-test-abc123.vercel.app");
  assert.equal(privacyPolicyUrl(), "https://domkazan-calendar-test-abc123.vercel.app/test-policy");
  process.env.VERCEL_URL = "evil.example.invalid";
  assert.throws(() => appOrigin(request));
  assert.equal(privacyPolicyUrl(), null);
  delete process.env.VERCEL_ENV;
  delete process.env.VERCEL_URL;
  delete process.env.TEST_CATALOG_ENABLED;
});
