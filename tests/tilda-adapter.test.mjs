import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const widget = readFileSync(new URL("../public/embed/domkazan-search.js", import.meta.url), "utf8");
const adapter = readFileSync(new URL("../public/embed/domkazan-tilda.js", import.meta.url), "utf8");
const tick = () => new Promise((resolve) => setImmediate(resolve));
// Reduced T778 structure observed in Tilda's public card renderer. No real content.
const card = (uid) => `<div data-product-uid="${uid}" data-product-url="/tproduct/${uid}-synthetic">
  <div><a href="#prodpopup"><img alt="Synthetic house"></a>
    <div><a href="#prodpopup"><h3>Synthetic house</h3><span>1000 р.</span></a>
      <a href="#prodpopup">Подробнее</a></div></div></div>`;
function fixture(mapping = [{ productUid: "101", houseSlug: "house-a" }, { productUid: "102", houseSlug: "house-b" }]) {
  const dom = new JSDOM('<div id="search"></div><section id="catalog"><input id="filter"><div id="grid"></div></section>',
    { url: "https://example.invalid/", runScripts: "outside-only" });
  const w = dom.window;
  w.eval(widget); w.eval(adapter);
  const calls = [];
  w.fetch = async (...args) => {
    calls.push(args);
    return { ok: true, json: async () => ({ houses: [{ id: "synthetic-a", slug: "house-a", name: "Synthetic house",
      quote: { total: "12345", nights: 2 } }] }) };
  };
  const root = w.document.getElementById("search");
  const catalog = w.document.getElementById("catalog");
  const grid = w.document.getElementById("grid");
  const controller = w.DomKazanTilda.mount({ root, catalog, mapping,
    apiUrl: "https://calendar.example.invalid/api/availability", privacyUrl: "https://example.invalid/privacy" });
  const form = root.shadowRoot.querySelector("form");
  form.querySelector('[name="checkIn"]').value = "2026-11-02";
  form.querySelector('[name="checkOut"]').value = "2026-11-04";
  function search() { form.dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true })); }
  return { dom, w, root, grid, catalog, controller, calls, form, search };
}

test("Tilda adapter waits for asynchronous cards and maps by UID without CSS or title matching", async () => {
  const f = fixture();
  f.search(); await tick();
  assert.equal(f.calls.length, 0);
  f.grid.innerHTML = card("101") + card("102"); await tick();
  assert.equal(f.root.shadowRoot.querySelector(".message").textContent, "");
  f.search(); await tick();
  const [free, busy] = f.grid.children;
  assert.match(free.querySelector('[data-domkazan-tilda-slot]').textContent, /12\s345 ₽ за 2 ноч/);
  assert.equal(busy.style.display, "none");
  assert.equal(free.querySelector("span").textContent, "1000 р.");
  assert.equal(free.querySelector("a").getAttribute("href"), "#prodpopup");
  f.controller.destroy();
  assert.equal(busy.style.display, "");
  assert.equal(f.catalog.querySelector('[data-domkazan-tilda-slot]'), null);
  f.dom.window.close();
});

test("Tilda request action stays outside links and does not trigger delegated popup click", async () => {
  const f = fixture();
  f.grid.innerHTML = card("101"); await tick();
  let popupClicks = 0;
  f.catalog.addEventListener("click", () => popupClicks++);
  f.search(); await tick();
  const button = f.grid.querySelector("button");
  assert.equal(button.closest("a"), null);
  button.click();
  assert.equal(popupClicks, 0);
  assert.equal(f.root.shadowRoot.querySelector(".request-form").hidden, false);
  f.grid.querySelector("a").click();
  assert.equal(popupClicks, 1);
  f.controller.destroy(); f.dom.window.close();
});

test("Tilda product popup does not create a duplicate catalog card", async () => {
  const f = fixture();
  f.grid.innerHTML = card("101"); await tick();
  f.search(); await tick();
  const popup = f.w.document.createElement("div");
  popup.className = "t-store__prod-popup__container";
  popup.innerHTML = `<div class="js-store-product t-store__product-popup" data-product-uid="101" data-product-url="/tproduct/101-synthetic">Synthetic popup</div>`;
  f.catalog.append(popup); await tick();
  assert.doesNotMatch(f.root.shadowRoot.textContent, /Поиск приостановлен/);
  assert.equal(f.grid.querySelectorAll('[data-domkazan-tilda-slot]').length, 1);
  popup.remove(); await tick();
  assert.doesNotMatch(f.root.shadowRoot.textContent, /Поиск приостановлен/);
  f.controller.destroy(); f.dom.window.close();
});

test("Tilda redraw and native filter changes clear stale application and preserve selected dates", async () => {
  const f = fixture();
  f.grid.innerHTML = card("101") + card("102"); await tick();
  f.search(); await tick(); f.grid.querySelector("button").click();
  f.catalog.querySelector("input").dispatchEvent(new f.w.Event("change", { bubbles: true }));
  assert.equal(f.root.shadowRoot.querySelector(".request-form").hidden, true);
  assert.equal(f.grid.querySelector("button"), null);
  f.search(); await tick(); f.grid.querySelector("button").click();
  f.grid.innerHTML = card("102") + card("101"); await tick();
  assert.equal(f.grid.querySelector("button"), null);
  assert.equal(f.root.shadowRoot.querySelector(".request-form").hidden, true);
  assert.equal(f.form.querySelector('[name="checkIn"]').value, "2026-11-02");
  f.search(); await tick();
  assert.equal(f.grid.firstElementChild.style.display, "none");
  assert.ok(f.grid.lastElementChild.querySelector("button"));
  f.controller.destroy(); f.dom.window.close();
});

test("late availability response cannot authorize an application after Tilda replaces cards", async () => {
  const f = fixture();
  f.grid.innerHTML = card("101"); await tick();
  let resolve;
  f.w.fetch = () => new Promise((done) => { resolve = done; });
  f.search();
  f.grid.innerHTML = card("101"); await tick();
  resolve({ ok: true, json: async () => ({ houses: [{ slug: "house-a", quote: { total: "1", nights: 2 } }] }) });
  await tick();
  assert.equal(f.grid.querySelector("button"), null);
  f.controller.destroy(); f.dom.window.close();
});

test("unknown or repeated UIDs pause search rather than imply availability; mapping is one-to-one", async () => {
  const f = fixture();
  for (const markup of [card("999"), card("101") + card("101")]) {
    f.grid.innerHTML = markup; await tick(); f.search(); await tick();
    assert.equal(f.calls.length, 0);
    assert.equal(f.grid.querySelector("button"), null);
    assert.match(f.root.shadowRoot.textContent, /Поиск приостановлен/);
    assert.equal(f.grid.firstElementChild.style.display, "");
  }
  assert.throws(() => f.w.DomKazanTilda.mount({ root: f.root, catalog: f.catalog, mapping: [
    { productUid: "101", houseSlug: "same" }, { productUid: "102", houseSlug: "same" },
  ] }), /уникальными/);
  f.controller.destroy(); f.dom.window.close();
});
