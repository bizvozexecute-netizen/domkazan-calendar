import { test, expect } from "@playwright/test";
import { db } from "../../src/lib/db";
import { dateKey, todayInMoscow } from "../../src/lib/dates";
import { selectStay } from "./stay-helper";
import {resetTestThrottle} from "./reset-throttle";

const day = (offset: number) => dateKey(new Date(todayInMoscow().getTime() + offset * 86_400_000));
const created: string[] = [];
test.beforeEach(resetTestThrottle);
test.afterEach(async () => {
  if (created.length) await db.bookingRequest.deleteMany({ where: { id: { in: created.splice(0) } } });
});
test.afterAll(async () => {
  await db.adminSession.deleteMany({ where: { email: "browser-tester@example.invalid" } });
  await db.$disconnect();
});

test("anonymous access cannot expose administrative pages or customer records", async ({ page, request }) => {
  for (const path of ["/admin", "/admin/houses", "/admin/requests", "/admin/settings"]) {
    await page.goto(path); await expect(page).toHaveURL(/\/admin\/login/);
  }
  expect((await request.get("/api/admin/requests")).status()).toBe(401);
  expect((await request.get("/api/admin/settings")).status()).toBe(401);
});

test("admin settings save accessible texts and reject a stale revision",async({page,request},testInfo)=>{
  await db.clientUiSettings.deleteMany();
  try {
    await page.goto('/admin/login');
    await page.getByLabel('Email',{exact:true}).fill('browser-tester@example.invalid');
    await page.getByLabel('Пароль',{exact:true}).fill(process.env.E2E_ADMIN_PASSWORD!);
    await page.getByRole('button',{name:'Войти',exact:true}).click();
    await expect(page).toHaveURL(/\/admin$/);
    await page.getByRole('link',{name:'Настройки',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Настройки каталога',exact:true})).toBeVisible();
    await page.getByLabel('Кнопка видео',{exact:true}).fill('Видео дома');
    await page.getByLabel('Основной цвет кнопок и ссылок: HEX',{exact:true}).fill('#164C9A');
    await page.getByRole('button',{name:'Сохранить настройки',exact:true}).click();
    await expect(page.getByRole('status')).toContainText('Настройки сохранены');
    const saved=await(await request.get('/api/client-settings')).json();
    expect(saved.texts.videoButton).toBe('Видео дома');expect(saved.colors.primary).toBe('#164C9A');
    expect((await request.put('/api/admin/settings',{headers:{origin:'http://localhost:3100'},data:{revision:0,settings:saved}})).status()).toBe(409);
    await page.getByLabel('Основной цвет кнопок и ссылок: HEX',{exact:true}).fill('#FFFFFF');
    await page.getByRole('button',{name:'Сохранить настройки',exact:true}).click();
    await expect(page.getByRole('alert')).toContainText('Контраст');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await page.screenshot({path:testInfo.outputPath('admin-settings.png'),fullPage:true});
  } finally {await db.clientUiSettings.deleteMany();}
});

test("catalog search, stale form reset, application and manual confirmation work together", async ({ page, request }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/test-catalog");
  await selectStay(page,day(2),day(4));
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
  await expect(page.locator('[data-domkazan-house="demo-house-02"]')).toBeHidden();
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
  const loginResponse = page.waitForResponse((response) => response.url().endsWith("/api/admin/login") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  expect((await loginResponse).status()).toBe(303);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Шахматка занятости" })).toBeVisible();
  await expect(page.locator("button[aria-pressed]").first()).toBeVisible();
  await expect(page.getByRole('region',{name:'Действия с выбранными датами',exact:true})).toBeHidden();
  await page.getByRole('button',{name:'Выбрать даты вручную',exact:true}).click();
  if (testInfo.project.name === "desktop") {
    const houseBox = await page.getByLabel("Дом", { exact: true }).boundingBox();
    const dateBox = await page.getByLabel("С даты", { exact: true }).boundingBox();
    expect(houseBox!.x + houseBox!.width).toBeLessThanOrEqual(dateBox!.x);
  }
  await page.getByLabel('Дом',{exact:true}).press('Escape');
  await expect(page.getByRole('button',{name:'Выбрать даты вручную',exact:true})).toBeFocused();
  await page.getByRole("button", { name: "Сегодня", exact: true }).click();
  const visibleToday=await page.locator(`[data-calendar-date="${day(0)}"]`).boundingBox();
  const stickyHouse=await page.locator('.calendar-grid-scroll thead th').first().boundingBox();
  expect(visibleToday!.x).toBeGreaterThanOrEqual(stickyHouse!.x+stickyHouse!.width-1);
  await page.screenshot({ path: testInfo.outputPath("admin-calendar.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.getByRole("link", { name: "Дома", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Дома", exact: true })).toBeVisible();
  await page.locator('a[href="/admin/houses/demo-house-01"]').click();
  await expect(page.getByRole("heading", { name: "Редактирование дома", exact: true })).toBeVisible();
  await expect(page.getByLabel("Максимум гостей *", { exact: true })).toHaveValue("4");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.getByRole("link", { name: "Заявки", exact: true }).click();
  await expect(page.getByLabel("Дом", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
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
