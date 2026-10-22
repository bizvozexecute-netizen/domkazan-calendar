import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { fixtureOrigin, fixtureProduct, fixtureDay, journeyFixture, openFixtureHouse } from './journey-fixture';

test.beforeEach(async ({ context }) => journeyFixture(context));

test('stalled gallery and enlarged photos offer retry and recover without stale loading timers', async ({ page, context }) => {
  await page.clock.install();
  const blocked = new Set([fixtureProduct.images[1], fixtureProduct.images[2]]);
  const waiting: { url: string; release: () => void }[] = [];
  await context.route('https://static.tildacdn.com/fixture-*.svg*', async route => {
    const url = new URL(route.request().url());const source=url.origin+url.pathname;
    if (blocked.has(source) && !url.searchParams.has('_dk_retry')) await new Promise<void>(release => waiting.push({ url:source, release }));
    await route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"/>' }).catch(() => {});
  });
  const release = (url: string) => { blocked.delete(url); for (const item of waiting) if (item.url === url) item.release(); };
  await openFixtureHouse(page);
  const photo = page.locator('.gallery .photo-button img'); await expect(photo).toHaveClass('loaded');
  await page.getByRole('button', { name: 'Фото 2', exact: true }).click();
  await page.clock.fastForward(16000);
  await expect(page.locator('.gallery .viewer .media-status')).toBeVisible();
  await expect(page.locator('.gallery .viewer .media-status')).toContainText('Фото загружается дольше обычного.');
  await page.getByRole('button', { name: 'Повторить загрузку фото', exact: true }).click();
  await expect(photo).toHaveClass('loaded');
  await expect(photo).toHaveAttribute('src', /_dk_retry=/);release(fixtureProduct.images[1]);
  await expect(page.getByRole('button', { name: 'Увеличить фото', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Увеличить фото', exact: true }).click();
  const zoom = page.getByRole('dialog', { name: 'Увеличенное фото', exact: true });
  await page.keyboard.press('ArrowRight'); await page.clock.fastForward(16000);
  await expect(zoom.locator('.media-status')).toBeVisible();
  await expect(zoom.locator('.media-status')).toContainText('Фото загружается дольше обычного.');
  await zoom.getByRole('button', { name: 'Повторить загрузку фото', exact: true }).click();
  await expect(zoom.locator('img')).toHaveClass('loaded');
  await expect(zoom.locator('img')).toHaveAttribute('src', /_dk_retry=/);release(fixtureProduct.images[2]);
  await page.keyboard.press('Escape'); await expect(photo).toHaveClass('loaded');
  await page.getByRole('button', { name: 'Фото 1', exact: true }).click();
  await expect(photo).toHaveClass('loaded'); await page.clock.fastForward(16000);
  await expect(page.getByRole('button', { name: 'Повторить загрузку фото', exact: true })).toHaveCount(0);
});

test('saved request replaces the displayed quote and removes its obsolete breakdown', async ({ page, context }) => {
  await context.route(`${fixtureOrigin}/api/availability?*`, route => route.fulfill({ json: { houses: [{
    id: fixtureProduct.slug, slug: fixtureProduct.slug, name: fixtureProduct.name,
    quote: { total: '10000', nights: 2, accommodationTotal: '9000', extraGuestTotal: '0', serviceFee: '1000' },
  }] } }));
  await context.route(`${fixtureOrigin}/api/requests`, route => route.fulfill({ status: 201,
    json: { requestId: 'synthetic-repriced', total: '13000', message: 'Тестовая заявка получена.', contacts: {} } }));
  await openFixtureHouse(page);
  await expect(page.locator('.quote-lines')).toContainText('Сервисный сбор');
  await page.getByRole('button', { name: `Оставить заявку: ${fixtureProduct.name}` }).click();
  await page.getByRole('checkbox', { name: /Согласен на обработку/ }).check();
  await page.getByRole('button', { name: 'Отправить заявку', exact: true }).click();
  await expect(page.locator('.receipt')).toContainText('Цена обновилась');
  await expect(page.locator('.summary div:last-child dd')).toHaveText(/13\s000 ₽/);
  await expect(page.locator('.booking-quote .price')).toHaveText(/13\s000 ₽ за 2 ноч\./);
  await expect(page.locator('.quote-lines')).toHaveCount(0);
  await expect(page.getByRole('button', { name: `Заявка отправлена: ${fixtureProduct.name}` })).toBeDisabled();
});

test('a newly confirmed quote also updates catalog price sorting without another request', async ({ page, context }) => {
  const products = [fixtureProduct, { ...fixtureProduct, productUid: '222222222222', slug: 'tilda-222222222222', name: 'Второй вымышленный дом' }];
  await context.route(`${fixtureOrigin}/api/catalog`, route => route.fulfill({ json: { products } }));
  let searches = 0;
  await context.route(`${fixtureOrigin}/api/availability?*`, route => { searches++; return route.fulfill({ json: {
    houses: products.map((product, index) => ({ id: product.slug, slug: product.slug, name: product.name, quote: { total: String(10000 + index * 2000), nights: 2 } })),
  } }); });
  await context.route(`${fixtureOrigin}/api/requests`, route => route.fulfill({ status: 201,
    json: { requestId: 'synthetic-repriced-sort', total: '20000', message: 'Тестовая заявка получена.', contacts: {} } }));
  await page.goto(`/resilience-fixture?checkIn=${fixtureDay(2)}&checkOut=${fixtureDay(4)}&guests=2`);
  await expect(page.locator('.count')).toHaveText('Найдено домов: 2');
  await page.getByLabel('Сортировать', { exact: true }).selectOption('price');
  await page.getByRole('button', { name: `Оставить заявку: ${fixtureProduct.name}` }).click();
  await page.getByRole('checkbox', { name: /Согласен на обработку/ }).check();
  await page.getByRole('button', { name: 'Отправить заявку', exact: true }).click();
  await expect(page.locator('.receipt')).toContainText('Цена обновилась');
  await expect(page.locator('.cards article').first()).toHaveAttribute('data-domkazan-house', products[1].slug);
  await expect(page.locator(`[data-domkazan-house="${fixtureProduct.slug}"] .price`)).toHaveText(/20\s000 ₽ за 2 ноч\./);
  expect(searches).toBe(1);
});

test('structured description, current quote and request explain the stay without stale tariffs', async ({ page, context }, testInfo) => {
  const product = { ...fixtureProduct, description: [
    'вместимость до 12 гостей', '3 спальни, 6 спальных мест', 'кухня, гостиная', 'веранда с мангалом',
    'возраст от 25 лет', 'С животными нельзя', '—', 'Будни - 5 000₽', 'Суббота - 9 000₽',
    'Цены до 8 гостей, далее 500₽/чел', 'Баня оплачивается отдельно 1000₽',
    'Свяжитесь с владельцем за специальным тарифом в будни 6000₽',
  ].join('\n') };
  await context.route(`${fixtureOrigin}/api/catalog`, route => route.fulfill({ json: { products: [product] } }));
  await context.route(`${fixtureOrigin}/api/availability?*`, route => route.fulfill({ json: { houses: [{
    id: product.slug, slug: product.slug, name: product.name,
    quote: { total: '13500', nights: 2, accommodationTotal: '10000', extraGuestTotal: '3000', serviceFee: '500' },
  }] } }));
  await openFixtureHouse(page);
  await expect(page.getByText('Дом свободен на выбранные даты.', { exact: true })).toBeVisible();
  await expect(page.locator('.booking-quote .price')).toHaveText(/13\s500 ₽ за 2 ноч\./);
  const copy = page.locator('.house-copy');
  await expect(copy.getByRole('heading', { name: 'Пространство и удобства', exact: true })).toBeVisible();
  await expect(copy.locator('.rules')).toContainText('С животными нельзя');
  await expect(copy).not.toContainText('Будни - 5 000₽');
  await expect(copy).not.toContainText('Суббота - 9 000₽');
  await expect(copy.getByText('Баня оплачивается отдельно 1000₽', { exact: true })).toBeHidden();
  await copy.locator('summary').focus(); await page.keyboard.press('Enter');
  await expect(copy.getByText('Баня оплачивается отдельно 1000₽', { exact: true })).toBeVisible();
  await expect(copy).toContainText('Свяжитесь с владельцем за специальным тарифом в будни 6000₽');
  await expect(page.locator('.quote-lines')).toHaveText(/Проживание10\s000 ₽Дополнительные гости3\s000 ₽Сервисный сбор500 ₽/);
  await expect(copy).toContainText('Отправка заявки не закрепляет даты');
  await expect(page.locator('.gallery .photo-button img')).toHaveClass('loaded');
  const stage = await page.locator('.photo-button').boundingBox();
  expect(stage!.height / stage!.width).toBeLessThanOrEqual(0.76);
  await page.getByRole('button', { name: 'Перейти к видео дома', exact: true }).click();
  await expect(page.locator('iframe[title="Видео дома на Rutube"]')).toBeVisible();
  await page.getByRole('button', { name: 'Фото 1', exact: true }).click();
  await page.getByRole('button', { name: `Оставить заявку: ${product.name}` }).click();
  await expect(page.locator('.request-form > .message')).not.toContainText('сервер');
  await expect(page.getByText(/При отправке проверим актуальную цену/)).toBeVisible();
  await page.getByLabel('Гостей', { exact: true }).fill('4');
  await expect(page.locator('.quote-lines')).toHaveCount(0);
  await expect(page.getByRole('form', { name: 'Заявка на проживание' })).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('structured-house.png'), fullPage: true });
});

test('card photo failure tries an alternative and always retains a useful house link', async ({ page, context }) => {
  await context.route(fixtureProduct.images[0], route => route.abort('failed'));
  await page.goto('/resilience-fixture');
  const cover = page.locator('.cover');
  await expect(cover).toHaveClass(/has-photo/);
  await expect(cover.locator('img')).toHaveAttribute('src', fixtureProduct.images[1]);
  await expect(page.locator('.price')).toHaveText('Узнать стоимостьвыберите даты и гостей');
  await context.route('https://static.tildacdn.com/fixture-*.svg', route => route.abort('failed'));
  await page.reload();
  await expect(cover).toContainText('Фото недоступно · открыть дом');
  await expect(cover.locator('img')).toHaveCount(0);
  await cover.click();
  await expect(page.getByRole('heading', { name: fixtureProduct.name, level: 1 })).toBeVisible();
});

test('public Tilda content fits catalog and house on every viewport', async ({ page, context }, testInfo) => {
  const snapshot = JSON.parse(await readFile('data/tilda-catalog-details.json', 'utf8'));
  const products = snapshot.products.slice(2, 5);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  // CI is deterministic and does not depend on the CDN. Opt-in local visual QA
  // loads existing public photos only; no Tilda writes or customer POSTs occur.
  if (process.env.UI_REAL_PHOTOS !== 'true') {
    await context.route(/^https:\/\/[^/]*tildacdn\.(com|info|net|pub)\//, route => route.fulfill({
      contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#c9d9e6"/></svg>',
    }));
  }
  await context.route(`${fixtureOrigin}/api/catalog`, route => route.fulfill({ json: { products } }));
  await context.route(`${fixtureOrigin}/api/availability?*`, route => {
    const uid = new URL(route.request().url()).searchParams.get('house');
    return route.fulfill({ json: { houses: products.filter((p: { slug: string }) => !uid || p.slug === uid).map((p: { slug: string; name: string }, index: number) => ({
      id: p.slug, slug: p.slug, name: p.name, quote: { total: String(28000 + 1000 * index), nights: 2 },
    })) } });
  });
  await page.goto(`/resilience-fixture?checkIn=${fixtureDay(2)}&checkOut=${fixtureDay(4)}&guests=8`);
  await expect(page.locator('.count')).toHaveText('Найдено домов: 3');
  for (const image of await page.locator('.cover img').all()) {
    await expect(image).toBeVisible();
    await expect(image.locator('..')).toHaveClass(/has-photo/, { timeout: 30000 });
  }
  await page.screenshot({ path: testInfo.outputPath('catalog-polished.png'), fullPage: true });
  await page.locator('.details-link').first().click();
  await expect(page.locator('.gallery .photo-button img')).toHaveClass('loaded', { timeout: 30000 });
  if ((testInfo.project.use.viewport?.width ?? 1280) > 760) {
    const galleryBox = await page.locator('.gallery').boundingBox();
    const bookingBox = await page.getByRole('complementary', { name: 'Стоимость и заявка' }).boundingBox();
    expect(Math.abs(bookingBox!.y - galleryBox!.y)).toBeLessThan(48);
  }
  // In a real browser, wait for the visible preview rail as well as the main
  // photo; a full-page screenshot alone does not activate offscreen lazy images.
  for (const thumb of await page.locator('.thumbnails img').all()) {
    const box = await thumb.boundingBox(); const rail = await page.locator('.thumbnails').boundingBox();
    if (box && rail && box.x < rail.x + rail.width && box.x + box.width > rail.x) {
      await expect.poll(() => thumb.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0), { timeout: 30000 }).toBe(true);
      await thumb.evaluate((img: HTMLImageElement) => img.decode());
    }
  }
  await expect(page.locator('.house-copy .rules')).toContainText('возраст от 20 лет');
  await expect(page.locator('.house-copy')).not.toContainText('Будни -');
  await page.locator('.extra-conditions summary').click();
  await expect(page.getByText('Баня оплачивается отдельно 1000₽', { exact: true })).toBeVisible();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: testInfo.outputPath('house-polished.png'), fullPage: true });
  await page.getByRole('button', { name: 'Увеличить фото', exact: true }).click();
  const zoom = page.getByRole('dialog', { name: 'Увеличенное фото', exact: true });
  await expect(zoom).toBeVisible(); await expect(zoom.locator('img')).toHaveCSS('object-fit', 'contain');
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
});
