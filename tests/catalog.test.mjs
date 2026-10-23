import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import {clientDay,clientStayQuery} from './client-dates.mjs';
import { publicCatalog,loadCatalog } from '../ops/tilda-test-gateway/lib/catalog.js';

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

test('parallel catalog cache misses share one source request',async()=>{
  const previous=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{calls++;await flush();return Response.json({total:0,products:[]});};
  try{const results=await Promise.all([loadCatalog(),loadCatalog(),loadCatalog()]);assert.equal(calls,1);assert.equal(results[0],results[1]);}
  finally{globalThis.fetch=previous;}
});

test('public detail snapshot covers the existing homes without customer data or old booking HTML', () => {
  assert.equal(details.products.length, 63);
  for (const product of details.products) {
    assert.ok(product.images.length > 0);
    assert.doesNotMatch(product.description, /<|homereserve\.ru|clientPhone|telegramBot/i);
  }
});

async function setup(suffix = '', mapHouse = house => house, options = {}) {
  const dom = new JSDOM('<div id="catalog"></div>', { url: `https://domkazan116.ru/calendar-test-311744409${suffix}`, runScripts: 'outside-only' });
  const win = dom.window;
  const products = details.products.slice(0, 3);
  win.fetch = async url => String(url).includes('/api/catalog') ? { ok: true, json: async () => ({ products }) } :
    { ok: true, json: async () => ({ houses: products.filter(product=>!String(url).includes('amenities=pool')||product.amenities.includes('pool')).map((product, index) => ({ id: product.slug, slug: product.slug,
      name: product.name, maxGuests: product.maxGuests, quote: { total: String(10000 + index * 5000), nights: 2 } })).map(mapHouse) }) };
  for (const file of ['domkazan-search.js', 'domkazan-catalog.js']) win.eval(readFileSync(new URL(`../public/embed/${file}`, import.meta.url), 'utf8'));
  const root = win.document.getElementById('catalog');
  const controller = win.DomKazanCatalog.mount({ root, apiOrigin: 'https://gateway.example.invalid', ...options });
  await flush();
  return { dom, win, root, shadow: root.shadowRoot, controller };
}

test('identical refreshed metadata preserves the first catalog DOM instead of remounting it',async()=>{
  const products=details.products.slice(0,3);let refresh;
  const f=await setup('',house=>house,{catalogData:{products},refreshCatalogData:new Promise(resolve=>{refresh=resolve;})});
  try{
    const first=f.shadow.querySelector('article');let ready=0;f.root.addEventListener('domkazan:ready',()=>ready++);
    refresh(JSON.parse(JSON.stringify({products})));await flush();
    assert.equal(f.shadow.querySelector('article'),first,'An unchanged refresh must not tear down the ready catalog');
    assert.equal(ready,0);
  }finally{f.controller.destroy();f.dom.window.close();}
});

test('filters combine with date search, quotes survive in separate house URLs, empty state is explicit', async () => {
  const { dom, win, shadow, controller } = await setup(`?${clientStayQuery}`);
  await flush();
  const widget = shadow.querySelector('.search > div').shadowRoot;
  assert.match(shadow.querySelector('.count').textContent, /Найдено домов: 3/);
  assert.equal(widget.querySelector('.message').textContent,'');
  assert.equal(shadow.querySelector('.price small').textContent, 'за 2 ноч.');
  const houseLink = shadow.querySelector('.details-link');
  const target=new URL(houseLink.href).searchParams;
  assert.equal(target.get('house'),'555240345232');assert.equal(target.get('checkIn'),clientDay(2));
  assert.equal(target.get('checkOut'),clientDay(4));assert.equal(target.get('guests'),'2');
  assert.equal(houseLink.target, '');
  const pool = widget.querySelector('input[value="pool"]');
  pool.checked = true; pool.dispatchEvent(new win.Event('change', { bubbles: true }));
  assert.ok(shadow.querySelector('.price small'), 'reset preserves the starting price caption and its formatting');
  assert.equal(widget.querySelector('[name="checkIn"]').value, clientDay(2));
  widget.querySelector('form').dispatchEvent(new win.Event('submit', { cancelable: true }));
  await flush();
  assert.match(shadow.querySelector('.count').textContent, /1$/);
  assert.equal(widget.querySelectorAll('.search-amenities input').length,3);
  assert.equal(shadow.querySelector('input[placeholder="Любой"]'),null);
  win.fetch=async()=>({ok:true,json:async()=>({houses:[]})});
  widget.querySelector('form').dispatchEvent(new win.Event('submit',{cancelable:true}));
  await flush();
  assert.equal(shadow.querySelector('.empty').hidden, false);
  assert.equal(shadow.querySelectorAll('[data-domkazan-action-for]').length, 0);
  controller.destroy(); dom.window.close();
});

test('direct house URL renders one full page and test request fields use synthetic details', async () => {
  const { dom, shadow, controller } = await setup(`?house=555240345232&${clientStayQuery}`);
  await flush();
  assert.equal(shadow.querySelector('h1').textContent, 'Казанка большой');
  assert.ok(shadow.querySelector('.gallery').shadowRoot.querySelector('img'));
  assert.equal(shadow.querySelectorAll('.card').length, 0);
  assert.ok(shadow.querySelector('a[href="https://t.me/viteek_b"]'));
  shadow.querySelector('.search > div').shadowRoot.querySelector('[data-domkazan-action-for] button').click();
  const request = shadow.querySelector('.search > div').shadowRoot.querySelector('.request-form');
  assert.equal(request.hidden, false);
  assert.equal(request.elements.clientName.value, 'Тестовый Гость');
  assert.equal(request.elements.clientPhone.value, '+70000000000');
  assert.equal(request.elements.consent.checked, false);
  controller.destroy(); dom.window.close();
});

test('catalog maps by explicit Product UID after slug rename and submits the database ID; an unlinked UID never falls back',async()=>{
  const first=details.products[0];
  const {dom,win,shadow,controller}=await setup(`?${clientStayQuery}`,house=>house.slug===first.slug
    ? {...house,id:'synthetic-database-id',slug:'renamed-internal-code',tildaProductUid:first.productUid}
    : {...house,tildaProductUid:null});
  await flush();assert.match(shadow.querySelector('.count').textContent,/Найдено домов: 1/);
  const widget=shadow.querySelector('.search > div').shadowRoot;
  let sent;
  win.fetch=async(_url,options)=>{sent=JSON.parse(options.body);return{ok:true,json:async()=>({requestId:'synthetic',total:'10000',message:'Test'})};};
  shadow.querySelector('[data-domkazan-action-for] button').click();
  const form=widget.querySelector('.request-form');form.elements.clientName.value='Synthetic';form.elements.clientPhone.value='+70000000000';form.elements.consent.checked=true;
  form.dispatchEvent(new win.Event('submit',{cancelable:true}));await flush();
  assert.equal(sent.houseId,'synthetic-database-id');assert.equal(Object.hasOwn(sent,'total'),false);
  controller.destroy();dom.window.close();
});
