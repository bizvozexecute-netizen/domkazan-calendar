import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { createElement, act } from "react";
import { dateKey, todayInMoscow } from "../src/lib/dates.ts";
import { attachCalendarAxisLock } from "../src/lib/calendar-axis-lock.ts";

test("native touch scroll locks the initial axis, keeps inertia and releases for wheel/pinch", () => {
  const dom = new JSDOM('<div id="scroll"></div>');
  const region = dom.window.document.getElementById("scroll")!;
  const cleanup = attachCalendarAxisLock(region);
  function touch(type: string, points: number[][]) {
    const event = new dom.window.Event(type, {cancelable:true});
    Object.defineProperty(event,"touches",{value:points.map(([clientX,clientY])=>({clientX,clientY}))});
    region.dispatchEvent(event);assert.equal(event.defaultPrevented,false);
  }
  region.scrollLeft=80;region.scrollTop=100;
  touch('touchstart',[[100,200]]);touch('touchmove',[[94,150]]);
  region.scrollLeft=95;region.scrollTop=160;region.dispatchEvent(new dom.window.Event('scroll'));
  assert.equal(region.scrollLeft,80);assert.equal(region.scrollTop,160);
  touch('touchend',[]);region.scrollLeft=90;region.scrollTop=200;region.dispatchEvent(new dom.window.Event('scroll'));
  assert.equal(region.scrollLeft,80,'secondary axis stays fixed during momentum');
  touch('touchstart',[[100,200]]);touch('touchmove',[[40,196]]);
  region.scrollLeft=150;region.scrollTop=210;region.dispatchEvent(new dom.window.Event('scroll'));
  assert.equal(region.scrollLeft,150);assert.equal(region.scrollTop,200);
  region.dispatchEvent(new dom.window.Event('wheel'));region.scrollTop=230;region.dispatchEvent(new dom.window.Event('scroll'));
  assert.equal(region.scrollTop,230);
  touch('touchstart',[[100,200],[130,200]]);region.scrollTop=240;region.dispatchEvent(new dom.window.Event('scroll'));
  assert.equal(region.scrollTop,240,'pinch zoom is not locked');
  cleanup();dom.window.close();
});

test("calendar cells are keyboard buttons and selected range reaches the admin API", async () => {
  const dom = new JSDOM("<!doctype html><html><body><main id='root'></main></body></html>", { url: "http://localhost:3000/admin" });
  const month = dateKey(todayInMoscow()).slice(0, 7);
  const first = `${month}-01`;
  const second = `${month}-02`;
  const third = `${month}-03`;
  const board = { month, dates: [first, second], houses: [{ id: "test-house", name: "Test House", slug: "test-house",
    isActive: true, revision: 0, cells: [first, second].map((date) => ({ date, price: "1000.00", source: "base", status: "free" })) }] };
  const calls: Array<{ url: string; body?: Record<string, unknown> }> = [];
  Object.assign(globalThis, {
    window: dom.window, self: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async (url: string, options?: RequestInit) => {
      calls.push({ url, body: options?.body ? JSON.parse(String(options.body)) : undefined });
      return new Response(JSON.stringify(options?.method === "POST" ? { revision: 1 } : board),
        { status: 200, headers: { "Content-Type": "application/json" } });
    },
  });
  dom.window.confirm = () => true;
  const { createRoot } = await import("react-dom/client");
  const { AdminCalendar } = await import("../src/components/admin-calendar.tsx");
  const container = dom.window.document.getElementById("root")!;
  const root = createRoot(container);
  await act(async () => { root.render(createElement(AdminCalendar)); });
  const cells = [...container.querySelectorAll<HTMLButtonElement>(".calendar-price[aria-pressed]")];
  assert.equal(cells.length, 2);
  assert.equal(cells[0].getAttribute("aria-label")?.includes(first), true);
  await act(async () => { cells[0].click(); cells[1].click(); });
  assert.equal(cells[0].getAttribute("aria-pressed"), "true");
  assert.equal(cells[1].getAttribute("aria-pressed"), "true");
  const close = [...container.querySelectorAll("button")].find((item) => item.textContent === "Закрыть даты");
  assert.ok(close);
  await act(async () => { close.click(); });
  assert.equal(calls.some(item => item.body?.action === "close"), false);
  const confirm = [...container.querySelectorAll("button")].find(item => item.textContent === "Подтвердить изменение");
  assert.ok(confirm);
  await act(async () => { confirm.click(); });
  const write = calls.find((item) => item.url === "/api/admin/calendar" && item.body?.action === "close");
  assert.equal(write?.body?.start, first);
  assert.equal(write?.body?.end, third);
  await act(async()=>{container.querySelector<HTMLButtonElement>('[aria-label="Закрыть панель действий"]')!.click();});
  assert.equal(dom.window.document.activeElement,cells[1]);
  assert.equal(container.querySelector<HTMLElement>('[aria-label="Действия с выбранными датами"]')?.hidden,true);
  await act(async () => { root.unmount(); });
  dom.window.close();
});
