import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const script = readFileSync(new URL("../public/embed/domkazan-search.js", import.meta.url), "utf8");

test("widget filters existing catalog cards and updates only their price labels", async () => {
  const dom = new JSDOM(`
    <div id="search"></div>
    <article data-domkazan-house="free"><h2>Дом А</h2><span data-domkazan-price>Старая цена А</span></article>
    <article data-domkazan-house="busy"><h2>Дом Б</h2><span data-domkazan-price>Старая цена Б</span></article>
  `, { url: "https://domkazan116.ru/", runScripts: "outside-only" });
  dom.window.fetch = async () => ({ ok: true, json: async () => ({ houses: [{ slug: "free", quote: { total: "12000.00", nights: 2 } }] }) });
  dom.window.eval(script);
  const controller = dom.window.DomKazanCalendar.mount({ root: dom.window.document.getElementById("search"), apiUrl: "https://calendar.example.invalid/api/availability" });
  const form = dom.window.document.getElementById("search").shadowRoot.querySelector("form");
  form.querySelector('[name="checkIn"]').value = "2026-11-02";
  form.querySelector('[name="checkOut"]').value = "2026-11-04";
  form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  await new Promise((resolve) => setImmediate(resolve));
  const free = dom.window.document.querySelector('[data-domkazan-house="free"]');
  const busy = dom.window.document.querySelector('[data-domkazan-house="busy"]');
  assert.equal(free.querySelector("h2").textContent, "Дом А");
  assert.match(free.querySelector("[data-domkazan-price]").textContent, /12\s000 ₽/);
  assert.equal(busy.style.getPropertyValue("display"), "none");
  assert.equal(busy.style.getPropertyPriority("display"), "important");
  dom.window.document.querySelector('[data-domkazan-action-for="free"] button').click();
  assert.equal(dom.window.document.getElementById("search").shadowRoot.querySelector(".request-form").hidden, true);
  controller.reset();
  assert.equal(busy.style.getPropertyValue("display"), "");
  assert.equal(free.querySelector("[data-domkazan-price]").textContent, "Старая цена А");
});

test("widget submits selected house without trusting a browser price and shows owner links", async () => {
  const dom = new JSDOM(`<div id="search" data-privacy-url="https://domkazan116.ru/privacy"></div>
    <article data-domkazan-house="free"><h2>Дом А</h2><span data-domkazan-price>Цена</span></article>`,
  { url: "https://domkazan116.ru/", runScripts: "outside-only" });
  Object.defineProperty(dom.window.crypto, "randomUUID", { value: () => "00000000-0000-4000-8000-000000000001" });
  const calls = [];
  dom.window.fetch = async (_url, options) => {
    if (!options || options.method === "GET") return { ok: true, json: async () => ({ houses: [{ id: "house-1", slug: "free", name: "Дом А", quote: { total: "12000.00", nights: 2 } }] }) };
    calls.push(JSON.parse(options.body));
    return { ok: true, json: async () => ({ requestId: "request-1", message: "Заявка получена.",
      contacts: { phone: "tel:+70000000000", telegram: "https://t.me/example_owner", whatsapp: null } }) };
  };
  dom.window.eval(script);
  dom.window.DomKazanCalendar.mount({ root: dom.window.document.getElementById("search"),
    apiUrl: "https://calendar.example.invalid/api/availability" });
  const shadow = dom.window.document.getElementById("search").shadowRoot;
  const search = shadow.querySelector("form");
  search.querySelector('[name="checkIn"]').value = "2026-11-02";
  search.querySelector('[name="checkOut"]').value = "2026-11-04";
  search.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  await new Promise((resolve) => setImmediate(resolve));
  dom.window.document.querySelector('[data-domkazan-action-for="free"] button').click();
  const application = shadow.querySelector(".request-form");
  application.querySelector('[name="clientName"]').value = "Synthetic Guest";
  application.querySelector('[name="clientPhone"]').value = "+70000000000";
  application.querySelector('[name="consent"]').checked = true;
  application.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].houseId, "house-1");
  assert.equal(calls[0].idempotencyKey, "00000000-0000-4000-8000-000000000001");
  assert.equal(Object.hasOwn(calls[0], "total"), false);
  assert.equal(calls[0].privacyPolicyUrl, "https://domkazan116.ru/privacy");
  assert.equal(shadow.querySelector(".contacts a").getAttribute("href"), "tel:+70000000000");
});

function fixture(fetch, getFilters) {
  const dom = new JSDOM(`<input id="filter"><div id="search" data-privacy-url="https://example.invalid/privacy"></div>
    <a href="#house-page" data-domkazan-house="free"><h2>Дом</h2><span data-domkazan-price>Цена</span></a>`,
  { url: "https://domkazan116.ru/", runScripts: "outside-only" });
  Object.defineProperty(dom.window.crypto, "randomUUID", { value: () => "00000000-0000-4000-8000-000000000001" });
  dom.window.fetch = fetch;
  dom.window.eval(script);
  const controller = dom.window.DomKazanCalendar.mount({ root: dom.window.document.getElementById("search"),
    apiUrl: "https://calendar.example.invalid/api/availability", getFilters });
  const shadow = dom.window.document.getElementById("search").shadowRoot;
  const form = shadow.querySelector("form");
  form.querySelector('[name="checkIn"]').value = "2026-11-02";
  form.querySelector('[name="checkOut"]').value = "2026-11-04";
  const submit = (target = form) => target.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  return { dom, controller, shadow, form, submit, action: () => dom.window.document.querySelector('[data-domkazan-action-for="free"] button') };
}
const found = () => ({ ok: true, json: async () => ({ houses: [{ id: "house-1", slug: "free", name: "Дом", quote: { total: "10000", nights: 2 } }] }) });
const tick = () => new Promise((resolve) => setImmediate(resolve));

test("date, guest and filter changes invalidate the chosen house and require another search", async () => {
  let filter = "";
  let posts = 0;
  const f = fixture(async (_url, options) => { if (options.method === "POST") posts++; return found(); }, () => ({ district: filter }));
  for (const name of ["checkIn", "checkOut", "guests"]) {
    f.submit(); await tick(); f.action().click();
    const field = f.form.querySelector(`[name="${name}"]`);
    field.value = name === "guests" ? "3" : name === "checkIn" ? "2026-11-01" : "2026-11-05";
    field.dispatchEvent(new f.dom.window.Event("input", { bubbles: true }));
    assert.equal(f.action(), null);
    assert.equal(f.shadow.querySelector(".request-form").hidden, true);
    f.submit(f.shadow.querySelector(".request-form")); await tick();
  }
  f.submit(); await tick(); f.action().click();
  filter = "new-district";
  f.dom.window.document.getElementById("filter").dispatchEvent(new f.dom.window.Event("change", { bubbles: true }));
  assert.equal(f.action(), null);
  f.submit(); await tick(); f.action().click();
  filter = "silent-programmatic-change";
  f.submit(f.shadow.querySelector(".request-form")); await tick();
  assert.equal(posts, 0);
  f.controller.destroy(); f.dom.window.close();
});

test("an outdated search response and a failed new search cannot restore old actions", async () => {
  let resolve;
  let calls = 0;
  const f = fixture(async () => { calls++; if (calls === 1) return new Promise((done) => { resolve = done; }); return { ok: false, json: async () => ({ error: "Unavailable" }) }; });
  f.submit();
  f.form.querySelector('[name="guests"]').value = "4";
  f.form.dispatchEvent(new f.dom.window.Event("change", { bubbles: true }));
  resolve(found()); await tick();
  assert.equal(f.action(), null);
  f.submit(); await tick();
  assert.equal(f.action(), null);
  f.controller.destroy(); f.dom.window.close();
});

test("application action is outside a linked card and does not trigger its navigation", async () => {
  const f = fixture(async () => found());
  let delegated = 0;
  f.dom.window.document.body.addEventListener("click", () => delegated++);
  f.submit(); await tick();
  assert.equal(f.action().closest("a"), null);
  assert.equal(f.dom.window.document.querySelector('[data-domkazan-house] button'), null);
  f.action().click();
  assert.equal(delegated, 0);
  assert.equal(f.shadow.querySelector(".request-form").hidden, false);
  assert.equal(f.dom.window.document.querySelector("a[data-domkazan-house]").getAttribute("href"), "#house-page");
  f.controller.destroy(); f.dom.window.close();
});

test("a non-clickable grid item can group its link and separate application slot", async () => {
  const dom = new JSDOM(`<div id="search"></div><div id="free"><a href="#free">Дом</a><span id="price">Цена</span><div id="slot"></div></div>
    <div id="busy"><a href="#busy">Занятый дом</a></div>`, { url: "https://domkazan116.ru/", runScripts: "outside-only" });
  dom.window.fetch = async () => found();
  dom.window.eval(script);
  const doc = dom.window.document;
  const controller = dom.window.DomKazanCalendar.mount({ root: doc.getElementById("search"), apiUrl: "https://calendar.example.invalid/api/availability",
    cards: [{ slug: "free", element: doc.getElementById("free"), priceElement: doc.getElementById("price"), actionElement: doc.getElementById("slot") },
      { slug: "busy", element: doc.getElementById("busy") }] });
  const form = doc.getElementById("search").shadowRoot.querySelector("form");
  form.dispatchEvent(new dom.window.Event("submit", { cancelable: true })); await tick();
  assert.equal(doc.querySelector("#slot button").closest("a"), null);
  assert.equal(doc.getElementById("busy").style.display, "none");
  controller.destroy(); dom.window.close();
});
