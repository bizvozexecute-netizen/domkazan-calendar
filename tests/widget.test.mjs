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
  assert.match(free.querySelector("[data-domkazan-price]").textContent, /12000\.00 ₽/);
  assert.equal(busy.style.getPropertyValue("display"), "none");
  assert.equal(busy.style.getPropertyPriority("display"), "important");
  free.querySelector("button").click();
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
  dom.window.document.querySelector("article button").click();
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
  assert.equal(shadow.querySelector(".contacts a").getAttribute("href"), "tel:+70000000000");
});
