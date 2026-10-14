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
  controller.reset();
  assert.equal(busy.style.getPropertyValue("display"), "");
  assert.equal(free.querySelector("[data-domkazan-price]").textContent, "Старая цена А");
});
