import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { publicCatalog } from '../ops/tilda-test-gateway/lib/catalog.js';

const details = JSON.parse(readFileSync(new URL('../data/tilda-catalog-details.json', import.meta.url), 'utf8'));
const flush = () => new Promise(resolve => setTimeout(resolve, 20));

test('catalog strips markup and private booking links; images stay on Tilda CDN', () => {
  const result = publicCatalog({ total: 1, products: [{ uid: '111111111111', title: '<b>Дом</b>',
    descr: 'вместимость до 8 гостей<br>3 спальни, 6 спальных мест<br>сауна, бассейн<br>—<br>Будни - 5 000₽',
    text: '<a href="https://homereserve.ru/secret">booking</a>',
    gallery: JSON.stringify([{ img: 'https://static.tildacdn.com/test.jpg' }, { img: 'javascript:alert(1)' }, { img: 'https://evil.invalid/pixel' }]) }] });
  assert.deepEqual(result.products[0].amenities, ['pool', 'sauna']);
  assert.equal(result.products[0].bedrooms, 3);
  assert.equal(result.products[0].beds, 6);
  assert.equal(result.products[0].maxGuests, 8);
  assert.equal(result.products[0].publicBaseRates.weekday, 5000);
  assert.deepEqual(result.products[0].images, ['https://static.tildacdn.com/test.jpg']);
  assert.doesNotMatch(JSON.stringify(result), /homereserve|javascript|evil\.invalid|<b>/);
  assert.throws(() => publicCatalog({ total: 2, products: [] }), /Incomplete/);
  assert.equal(publicCatalog({ total: 1, products: [{ uid: '111111111111', title: 'Дом', descr: '10 спальных мест' }] }).products[0].bedrooms, null);
});

test('public detail snapshot covers the existing homes without customer data or old booking HTML', () => {
  assert.equal(details.products.length, 63);
  for (const product of details.products) {
    assert.ok(product.images.length > 0);
    assert.doesNotMatch(product.description, /<|homereserve\.ru|clientPhone|telegramBot/i);
  }
});

async function setup(suffix = '') {
  const dom = new JSDOM('<div id="catalog"></div>', { url: `https://domkazan116.ru/calendar-test-311744409${suffix}`, runScripts: 'outside-only' });
  const win = dom.window;
  const products = details.products.slice(0, 3);
  win.fetch = async url => String(url).includes('/api/catalog') ? { ok: true, json: async () => ({ products }) } :
    { ok: true, json: async () => ({ houses: products.map((product, index) => ({ id: product.slug, slug: product.slug,
      name: product.name, maxGuests: product.maxGuests, quote: { total: String(10000 + index * 5000), nights: 2 } })) }) };
  for (const file of ['domkazan-search.js', 'domkazan-catalog.js']) win.eval(readFileSync(new URL(`../public/embed/${file}`, import.meta.url), 'utf8'));
  const root = win.document.getElementById('catalog');
  const controller = win.DomKazanCatalog.mount({ root, apiOrigin: 'https://gateway.example.invalid' });
  await flush();
  return { dom, win, root, shadow: root.shadowRoot, controller };
}

test('filters combine with date search, quotes survive in separate house URLs, empty state is explicit', async () => {
  const { dom, win, shadow, controller } = await setup('?checkIn=2026-11-02&checkOut=2026-11-04&guests=2');
  await flush();
  const widget = shadow.querySelector('.search > div').shadowRoot;
  assert.match(widget.querySelector('.message').textContent, /Свободных домов: 3/);
  const houseLink = shadow.querySelector('.details-link');
  assert.match(houseLink.href, /house=555240345232&checkIn=2026-11-02&checkOut=2026-11-04&guests=2/);
  assert.equal(houseLink.target, '_blank');
  const pool = shadow.querySelector('input[value="pool"]');
  pool.checked = true; pool.dispatchEvent(new win.Event('change', { bubbles: true }));
  assert.ok(shadow.querySelector('.price small'), 'reset preserves the starting price caption and its formatting');
  assert.equal(widget.querySelector('[name="checkIn"]').value, '2026-11-02');
  widget.querySelector('form').dispatchEvent(new win.Event('submit', { cancelable: true }));
  await flush();
  assert.match(shadow.querySelector('.count').textContent, /1$/);
  const budget = shadow.querySelector('input[placeholder="Любой"]');
  budget.value = '100'; budget.dispatchEvent(new win.Event('input', { bubbles: true }));
  widget.querySelector('form').dispatchEvent(new win.Event('submit', { cancelable: true }));
  await flush();
  assert.equal(shadow.querySelector('.empty').hidden, false);
  assert.equal(shadow.querySelectorAll('[data-domkazan-action-for]').length, 0);
  controller.destroy(); dom.window.close();
});

test('direct house URL renders one full page and test request fields use synthetic details', async () => {
  const { dom, shadow, controller } = await setup('?house=555240345232&checkIn=2026-11-02&checkOut=2026-11-04&guests=2');
  await flush();
  assert.equal(shadow.querySelector('h1').textContent, 'Казанка большой');
  assert.ok(shadow.querySelector('.main-photo'));
  assert.equal(shadow.querySelectorAll('.card').length, 0);
  assert.ok(shadow.querySelector('a[href="https://t.me/viteek_b"]'));
  shadow.querySelector('[data-domkazan-action-for] button').click();
  const request = shadow.querySelector('.search > div').shadowRoot.querySelector('.request-form');
  assert.equal(request.hidden, false);
  assert.equal(request.elements.clientName.value, 'Тестовый Гость');
  assert.equal(request.elements.clientPhone.value, '+70000000000');
  assert.equal(request.elements.consent.checked, false);
  controller.destroy(); dom.window.close();
});
