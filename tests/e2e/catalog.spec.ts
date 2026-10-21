import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import { db } from "../../src/lib/db";
import { dateKey, todayInMoscow } from "../../src/lib/dates";
import {resetTestThrottle} from "./reset-throttle";

const uid = "111111111111";
const slug = `tilda-${uid}`;
const day = (offset: number) => dateKey(new Date(todayInMoscow().getTime() + offset * 86400000));
test.beforeEach(resetTestThrottle);

test.afterEach(async () => {
  await db.bookingRequest.deleteMany({ where: { houseId: slug } });
  await db.house.deleteMany({ where: { id: slug } });
});
test.afterAll(async () => { await db.$disconnect(); });

test("Tilda catalog, house page, price changes, occupancy and request use the same database", async ({ page, request, context }, testInfo) => {
  await db.house.create({ data: { id: slug, slug, name: "Проверочный дом", maxGuests: 20,
    amenities:["pool","sauna"],
    includedGuests: 2, extraGuestPrice: "200", serviceFee: "500", isActive: true,
    baseRates: { create: { startsOn: todayInMoscow(), endsOn: new Date(`${day(90)}T00:00:00Z`),
      weekdayPrice: "1000", fridayPrice: "1000", saturdayPrice: "1000", sundayPrice: "1000" } } } });
  const snapshot = JSON.parse(await readFile("data/tilda-catalog-details.json", "utf8"));
  const product = { ...snapshot.products[0], productUid: uid, slug, name: "Проверочный дом", amenities: ["pool", "sauna"], bedrooms: 4 };
  const origin = "https://catalog.example.invalid";
  await context.route(`${origin}/api/catalog`, route => route.fulfill({ json: { products: [product] } }));
  await context.route(`${origin}/api/availability?*`, async route => {
    const response = await request.get(`/api/availability${new URL(route.request().url()).search}`);
    await route.fulfill({ json: await response.json(), status: response.status() });
  });
  await context.route(`${origin}/api/house-calendar?*`,async route=>{
    const month=new URL(route.request().url()).searchParams.get('month');
    const response=await request.get(`/api/houses/${slug}/calendar?month=${month}`);
    await route.fulfill({json:await response.json(),status:response.status()});
  });
  await context.route(`${origin}/api/requests`, async route => {
    const response = await request.post("/api/requests", { data: route.request().postDataJSON(),
      headers: { origin: "http://localhost:3100" } });
    await route.fulfill({ json: await response.json(), status: response.status() });
  });
  // Real browser, real quote/request endpoints; only the public content source is a fixture.
  await context.route("**/catalog-fixture*", route => route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="ru"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}</style><div id="catalog"></div><script src="/embed/domkazan-search.js"></script><script src="/embed/domkazan-catalog.js"></script><script>DomKazanCatalog.mount({root:document.getElementById('catalog'),apiOrigin:'${origin}',privacyUrl:'https://example.invalid/privacy',pagePath:'/catalog-fixture'});</script></html>` }));
  const path = `/catalog-fixture?checkIn=${day(10)}&checkOut=${day(12)}&guests=3`;
  await page.goto(path);
  await expect(page.getByText("Найдено домов: 1", { exact: true })).toBeVisible();
  await expect(page.locator(".price")).toHaveText(/2\s900 ₽ за 2 ноч\./);
  await page.getByRole("checkbox", { name: "Бассейн", exact: true }).check();
  await expect(page.getByRole("button", { name: "Оставить заявку: Проверочный дом" })).toHaveCount(0);
  await page.getByRole("button", { name: "Показать свободные дома" }).click();
  await expect(page.getByText("Найдено домов: 1", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("catalog.png"), fullPage: true });
  const detailPath = await page.getByRole("link", { name: "Подробнее о доме →" }).getAttribute("href");
  await page.goto(detailPath!);
  await expect(page.getByRole("heading", { level: 1, name: "Проверочный дом" })).toBeVisible();
  await expect(page.getByText(/дополнительные гости 400 ₽ · сбор 500 ₽/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("house.png"), fullPage: true });
  await page.getByRole("button", { name: "Оставить заявку: Проверочный дом" }).click();
  await page.getByRole("checkbox", { name: /Согласен на обработку/ }).check();
  const sent = page.waitForResponse(response => response.url() === `${origin}/api/requests`);
  await page.getByRole("button", { name: "Отправить заявку", exact: true }).click();
  const sentResponse = await sent;
  expect(sentResponse.status(), await sentResponse.text()).toBe(201);
  await expect(page.locator('.receipt > p')).toHaveText(/Заявка .*Проверочный дом/);
  const booking = await db.bookingRequest.findFirstOrThrow({ where: { houseId: slug } });
  expect(booking.quotedTotal?.toString()).toBe("2900");
  expect(booking.status).toBe("NEW");
  expect(await db.telegramNotification.count({ where: { bookingRequestId: booking.id } })).toBe(1);

  await page.goto("/admin/login");
  await page.getByLabel("Email", { exact: true }).fill("browser-tester@example.invalid");
  await page.getByLabel("Пароль", { exact: true }).fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByLabel("Дом", { exact: true }).selectOption(slug);
  await page.getByLabel("С даты", { exact: true }).fill(day(10));
  await page.getByLabel("По дату включительно", { exact: true }).fill(day(11));
  await page.getByLabel("Ручная цена, ₽", { exact: true }).fill("2000");
  await page.getByRole("button", { name: "Изменить стоимость", exact: true }).click();
  await page.getByRole("button", { name: "Подтвердить изменение", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Изменения сохранены");
  await page.goto(path);
  await expect(page.locator(".price")).toHaveText(/4\s900 ₽ за 2 ноч\./);
  await page.goto(`/admin?month=${day(10).slice(0, 7)}`);
  await page.getByLabel("Дом", { exact: true }).selectOption(slug);
  await page.getByLabel("С даты", { exact: true }).fill(day(10));
  await page.getByLabel("По дату включительно", { exact: true }).fill(day(11));
  await page.getByRole("button", { name: "Закрыть даты", exact: true }).click();
  await page.getByRole("button", { name: "Подтвердить изменение", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Изменения сохранены");
  await page.goto(path);
  await expect(page.getByText("Найдено домов: 0", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Подходящих домов не нашлось" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Оставить заявку: Проверочный дом" })).toHaveCount(0);
});
