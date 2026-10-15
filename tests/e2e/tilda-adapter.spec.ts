import { test, expect } from "@playwright/test";

test("dynamic Tilda-shaped catalog keeps keyboard actions separate from links", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/test-policy", (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><html><body></body></html>" }));
  await page.route("**/api/availability?*", (route) => route.fulfill({ json: { houses: [
    { id: "synthetic-a", slug: "synthetic-a", name: "Тестовый дом А", quote: { total: "12000", nights: 2 } },
  ] } }));
  await page.goto("/test-policy");
  await page.setContent(`<meta name="viewport" content="width=device-width, initial-scale=1"><main><div id="search"></div><section id="catalog">
    <label>Фильтр Tilda <input id="filter"></label><div id="grid"></div>
  </section></main>`);
  await page.addScriptTag({ path: "public/embed/domkazan-search.js" });
  await page.addScriptTag({ path: "public/embed/domkazan-tilda.js" });
  await page.evaluate(() => {
    Reflect.get(window, "DomKazanTilda").mount({
      root: document.getElementById("search"), catalog: document.getElementById("catalog"),
      apiUrl: `${location.origin}/api/availability`, privacyUrl: "https://example.invalid/privacy",
      mapping: [{ productUid: "101", houseSlug: "synthetic-a" }, { productUid: "102", houseSlug: "synthetic-b" }],
    });
    const grid = document.getElementById("grid")!;
    grid.innerHTML = ["101", "102"].map((uid) => `<article data-product-uid="${uid}" data-product-url="/tproduct/${uid}-synthetic">
      <div><a href="#prodpopup">Подробнее о тестовом доме ${uid}</a></div></article>`).join("");
  });
  await page.getByLabel("Заезд", { exact: true }).fill("2026-11-02");
  await page.getByLabel("Выезд", { exact: true }).fill("2026-11-04");
  await page.getByRole("button", { name: "Показать свободные дома" }).click();
  await expect(page.locator('[data-product-uid="102"]')).toBeHidden();
  await expect(page.locator('[data-product-uid="101"]')).toContainText("12000 ₽ за 2 ноч.");
  const action = page.getByRole("button", { name: "Оставить заявку: Тестовый дом А" });
  expect(await action.evaluate((button) => button.closest("a") === null)).toBe(true);
  await action.focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("form", { name: "Заявка на проживание" })).toBeVisible();
  expect(new URL(page.url()).hash).toBe("");
  await page.getByLabel("Фильтр Tilda").fill("новый фильтр");
  await expect(action).toHaveCount(0);
  await expect(page.getByRole("form", { name: "Заявка на проживание" })).toBeHidden();
  await expect(page.getByLabel("Заезд", { exact: true })).toHaveValue("2026-11-02");
  await page.getByRole("button", { name: "Показать свободные дома" }).click();
  await expect(action).toBeVisible();
  if (testInfo.project.name === "mobile") expect(await page.evaluate(() => window.innerWidth)).toBeLessThan(760);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("tilda-adapter.png"), fullPage: true });
  await page.getByRole("link", { name: "Подробнее о тестовом доме 101" }).click();
  expect(new URL(page.url()).hash).toBe("#prodpopup");
  expect(errors).toEqual([]);
});
