import { expect, type Page } from "@playwright/test";

export async function showCalendarDay(page: Page, value: string) {
  for (let index = 0; index < 25 && await page.locator(`.calendar-grid [data-day="${value}"]`).count() === 0; index++) {
    await page.getByRole("button", { name: "Следующий месяц", exact: true }).click();
  }
  await expect(page.locator(`.calendar-grid [data-day="${value}"]`)).toBeVisible();
}

export async function selectStay(page: Page, checkIn: string, checkOut: string) {
  await page.getByRole("button", { name: "Заезд", exact: true }).click();
  for (const value of [checkIn, checkOut]) {
    await showCalendarDay(page, value);
    await page.locator(`.calendar-grid [data-day="${value}"]`).click();
  }
  await expect(page.getByRole("dialog", { name: "Выбор дат проживания" })).toBeHidden();
}
