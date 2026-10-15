import { request } from "node:https";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";

// Fixed loopback target only. The exception is for the generated self-signed test certificate.
function call(path, { method = "GET", headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = request({ hostname: "localhost", port: 8443, path, method, rejectUnauthorized: false,
      headers, timeout: 10_000 }, (response) => {
      let data = "";
      const tls = response.socket.getProtocol();
      response.on("data", (chunk) => { data += chunk; if (data.length > 1_000_000) req.destroy(new Error("Response too large")); });
      response.on("end", () => resolve({ status: response.statusCode, headers: response.headers, data, tls }));
    });
    req.on("timeout", () => req.destroy(new Error("Proxy timeout")));
    req.on("error", reject);
    req.end(body);
  });
}
const origin = "https://localhost:8443";
const health = await call("/api/health");
assert.equal(health.status, 200); assert.match(health.tls, /^TLSv1\.[23]$/);
assert.equal((await call("/api/internal/telegram/retry", { method: "POST" })).status, 404);
assert.equal((await call("/api/admin/requests")).status, 401);
const credentials = JSON.parse(readFileSync(".local-test-credentials.json", "utf8"));
const loginBody = new URLSearchParams(credentials).toString();
const login = await call("/api/admin/login", { method: "POST", headers: {
  Origin: origin, Host: "forged.example.invalid", "X-Forwarded-Host": "forged.example.invalid",
  "X-Forwarded-Proto": "http", "Content-Type": "application/x-www-form-urlencoded",
}, body: loginBody });
assert.equal(login.status, 303); assert.equal(login.headers.location, `${origin}/admin`);
const cookie = login.headers["set-cookie"]?.[0];
assert.match(cookie ?? "", /HttpOnly/i); assert.match(cookie, /Secure/i); assert.match(cookie, /SameSite=Strict/i);
const admin = await call("/admin/requests", { headers: { Cookie: cookie.split(";")[0] } });
assert.equal(admin.status, 200); assert.match(admin.headers["cache-control"], /no-store/);
assert.equal((await call("/api/admin/logout", { method: "POST", headers: { Origin: "https://foreign.example.invalid", Cookie: cookie.split(";")[0] } })).status, 403);
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const base = new Date(`${today}T00:00:00Z`);
const date = (offset) => new Date(base.getTime() + offset * 86_400_000).toISOString().slice(0, 10);
for (let index = 0; index < 13; index++) {
  const result = await call("/api/requests", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json",
    "X-Forwarded-For": `192.0.2.${index + 1}`, "X-DomKazan-Client-IP": `192.0.2.${index + 1}`, "X-DomKazan-Proxy-Secret": "forged" },
  body: JSON.stringify({ houseId: "does-not-exist", checkIn: date(2), checkOut: date(4), guestCount: 2,
    clientName: "Proxy Synthetic Guest", clientPhone: `+70000000${String(index).padStart(3, "0")}`,
    consent: true, privacyPolicyUrl: `${origin}/test-policy`, idempotencyKey: randomUUID() }) });
  assert.equal(result.status, index < 12 ? 409 : 429);
  assert.equal(result.data.includes("Proxy Synthetic Guest"), false);
}
await call("/api/admin/logout", { method: "POST", headers: { Origin: origin, Cookie: cookie.split(";")[0] } });
console.log("Reverse proxy verified: TLS, canonical redirects, protected pages, secure cookie, private retry route and IP spoof resistance.");
