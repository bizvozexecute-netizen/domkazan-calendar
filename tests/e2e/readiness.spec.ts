import { test, expect } from "@playwright/test";
import { db } from "../../src/lib/db";
import { dateKey, todayInMoscow } from "../../src/lib/dates";

const day = (offset: number) => dateKey(new Date(todayInMoscow().getTime() + offset * 86_400_000));
const created: string[] = [];
test.afterEach(async () => {
  if (created.length) await db.bookingRequest.deleteMany({ where: { id: { in: created.splice(0) } } });
});
test.afterAll(async () => {
  await db.adminSession.deleteMany({ where: { email: "browser-tester@example.invalid" } });
  await db.$disconnect();
});

test("anonymous access cannot expose administrative pages or customer records", async ({ page, request }) => {
  for (const path of ["/admin", "/admin/houses", "/admin/requests"]) {
    await page.goto(path); await expect(page).toHaveURL(/\/admin\/login/);
  }
  expect((await request.get("/api/admin/requests")).status()).toBe(401);
});

test("catalog search, stale form reset, application and manual confirmation work together", async ({ page, request }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/test-catalog");
  await page.getByLabel("Заезд", { exact: true }).fill(day(2));
  await page.getByLabel("Выезд", { exact: true }).fill(day(4));
  const search = page.getByRole("button", { name: "Показать свободные дома" });
  await search.click();
  const action = page.locator('[data-domkazan-action-for="demo-house-01"] button');
  await expect(action).toBeVisible();
  expect(await action.evaluate((button) => button.closest("a") === null)).toBe(true);
  await action.click();
  await expect(page.getByRole("form", { name: "Заявка на проживание" })).toBeVisible();
  await page.getByLabel("Гостей", { exact: true }).fill("3");
  await expect(action).toHaveCount(0);
  await expect(page.getByRole("form", { name: "Заявка на проживание" })).toBeHidden();
  await search.click(); await expect(action).toBeVisible(); await action.click();
  await page.getByLabel("Район", { exact: true }).selectOption("Тестовый север");
  await expect(action).toHaveCount(0);
  await search.click(); await expect(action).toBeVisible();
  await action.click();
  expect(new URL(page.url()).hash).toBe("");
  await expect(page.getByRole("link", { name: "Политика обработки данных" })).toHaveAttribute("href", "https://example.invalid/privacy");
  await page.screenshot({ path: testInfo.outputPath("widget.png"), fullPage: true });
  await page.getByLabel("Имя", { exact: true }).fill("Synthetic Browser Guest");
  await page.getByLabel("Телефон", { exact: true }).fill("+70000000000");
  await page.getByRole("checkbox").check();
  const responsePromise = page.waitForResponse((response) => response.url().endsWith("/api/requests") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Отправить заявку", exact: true }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(201);
  const receipt = await response.json(); created.push(receipt.requestId);
  expect(JSON.stringify(receipt)).not.toContain("Synthetic Browser Guest");
  expect(JSON.stringify(receipt)).not.toContain("+70000000000");
  await expect(page.getByText(`Заявка ${receipt.requestId}:`, { exact: false })).toBeVisible();
  const query = `/api/availability?checkIn=${day(2)}&checkOut=${day(4)}&guests=3`;
  expect((await (await request.get(query)).json()).houses.some((house: { slug: string }) => house.slug === "demo-house-01")).toBe(true);

  await page.goto("/admin/login");
  await page.getByLabel("Email", { exact: true }).fill("browser-tester@example.invalid");
  await page.getByLabel("Пароль", { exact: true }).fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Шахматка занятости" })).toBeVisible();
  await expect(page.locator("button[aria-pressed]").first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("admin-calendar.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.getByRole("link", { name: "Дома", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Дома", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Заявки", exact: true }).click();
  const card = page.getByRole("article").filter({ hasText: "Сосновый свет" }).first();
  await card.getByRole("button", { name: "Открыть контакты" }).click();
  await expect(card.getByText("Synthetic Browser Guest", { exact: false })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await card.getByRole("button", { name: "Подтверждена", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Подтверждена");
  expect((await (await request.get(query)).json()).houses.some((house: { slug: string }) => house.slug === "demo-house-01")).toBe(false);
  await card.getByRole("link", { name: "Показать в шахматке" }).click();
  await expect(page).toHaveURL(/house=demo-house-01/);
  await expect(page.getByRole("button", { name: new RegExp(`Сосновый свет.*${day(2)}.*Заявка подтверждена`) })).toBeVisible();
  expect(errors).toEqual([]);
});
