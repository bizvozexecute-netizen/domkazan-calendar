import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { createElement, act } from "react";
import { dateKey, todayInMoscow } from "../src/lib/dates.ts";

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
  const cells = [...container.querySelectorAll<HTMLButtonElement>("button[aria-pressed]")];
  assert.equal(cells.length, 2);
  assert.equal(cells[0].getAttribute("aria-label")?.includes(first), true);
  await act(async () => { cells[0].click(); cells[1].click(); });
  assert.equal(cells[0].getAttribute("aria-pressed"), "true");
  assert.equal(cells[1].getAttribute("aria-pressed"), "true");
  const close = [...container.querySelectorAll("button")].find((item) => item.textContent === "Закрыть даты");
  assert.ok(close);
  await act(async () => { close.click(); });
  const write = calls.find((item) => item.url === "/api/admin/calendar" && item.body?.action === "close");
  assert.equal(write?.body?.start, first);
  assert.equal(write?.body?.end, third);
  await act(async () => { root.unmount(); });
  dom.window.close();
});
