import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GET } from '../ops/tilda-test-gateway/api/availability.js';
import { POST } from '../ops/tilda-test-gateway/api/requests.js';
import {GET as calendarGet} from '../ops/tilda-test-gateway/api/house-calendar.js';
import {renderTildaTestSnippet} from '../scripts/render-tilda-test-snippet.mjs';

const gateway = 'https://domkazan-calendar-tilda-test-gatewa.vercel.app';
const upstream = 'https://domkazan-calendar-test-cnu827x24-iss-projects-5d0a08b3.vercel.app';
const headers = { origin: 'https://domkazan116.ru', 'x-vercel-oidc-token': 'test-oidc' };
const query = 'checkIn=2026-10-20&checkOut=2026-10-22&guests=2';
const tildaHouse = { id: 'test-tilda-id', slug: 'tilda-259712110892', quote: { total: '14000.00' } };

test('prepared test-page snippet stays synchronized with the reviewed bootstrap',async()=>{
  const snippet=await renderTildaTestSnippet(gateway);
  assert.equal(readFileSync(new URL('../integration/tilda-311744409-t123.html',import.meta.url),'utf8').replace(/\r\n/g,'\n'),snippet);
  await assert.rejects(renderTildaTestSnippet('https://example.invalid'),/reviewed test gateway/);
});

test('first-paint cache contains only public Tilda metadata and keeps T123 small',async()=>{
  const data=JSON.parse(readFileSync(new URL('../data/tilda-catalog-initial.json',import.meta.url),'utf8'));
  assert.equal(data.products.length,63);
  assert.doesNotMatch(JSON.stringify(data),/clientPhone|clientName|requestId|blockedPeriod|homereserve\.ru|<script/i);
  const allowed=['productUid','slug','name','description','facts','images','amenities','rutubeUrl','maxGuests','bedrooms','beds','publicBaseRates','includedGuests','extraGuestPrice','serviceFee'];
  for(const product of data.products){
    assert.ok(Object.keys(product).every(key=>allowed.includes(key)));
    assert.match(product.productUid,/^\d{12}$/);
  }
  const snippet=await renderTildaTestSnippet(gateway);
  assert.ok(snippet.length < 12000);
  assert.doesNotMatch(snippet, /type="application\/json"/);
  for (const path of ['../public/embed/', '../ops/tilda-test-gateway/public/embed/']) {
    assert.deepEqual(JSON.parse(readFileSync(new URL(`${path}domkazan-catalog-initial.json`,import.meta.url),'utf8')),data);
  }
  const config=JSON.parse(readFileSync(new URL('../ops/tilda-test-gateway/vercel.json',import.meta.url),'utf8'));
  assert.deepEqual(config.headers,[{source:'/embed/domkazan-catalog-initial.json',headers:[{key:'Access-Control-Allow-Origin',value:'https://domkazan116.ru'}]}]);
});

test('calendar gateway validates UID and source before forwarding',async()=>{
  assert.equal((await calendarGet(new Request(`${gateway}/api/house-calendar?house=tilda-259712110892&month=2026-11`))).status,403);
  assert.equal((await calendarGet(new Request(`${gateway}/api/house-calendar?house=../../admin&month=2026-11`,{headers}))).status,400);
});

test('public gateway serves the reviewed adapter and widget unchanged', () => {
  for (const name of ['domkazan-search.js', 'domkazan-tilda.js', 'domkazan-catalog.js', 'domkazan-test-bootstrap.js']) {
    assert.equal(readFileSync(new URL(`../ops/tilda-test-gateway/public/embed/${name}`, import.meta.url), 'utf8'),
      readFileSync(new URL(`../public/embed/${name}`, import.meta.url), 'utf8'));
  }
});

test('gateway rejects other origins without calling the protected application', async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('must not forward'); };
  try {
    const response = await GET(new Request(`${gateway}/api/availability?${query}`));
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
  } finally { globalThis.fetch = previous; }
});

test('gateway sends only a Vercel identity to Preview and exposes Tilda houses', async () => {
  const previousFetch = globalThis.fetch;
  const previousOrigin = process.env.GATEWAY_UPSTREAM_ORIGIN;
  process.env.GATEWAY_UPSTREAM_ORIGIN = upstream;
  const mappedHouse={...tildaHouse,id:'mapped-id',slug:'renamed-internal-code',tildaProductUid:'111111111111'};
  globalThis.fetch = async (url, options) => {
    assert.equal(new URL(url).origin, upstream);
    assert.equal(options.headers['x-vercel-trusted-oidc-idp-token'], 'test-oidc');
    return Response.json({ houses: [tildaHouse,mappedHouse,{...tildaHouse,id:'unlinked',tildaProductUid:null}, { id: 'demo', slug: 'demo-house-01' }] });
  };
  try {
    const response = await GET(new Request(`${gateway}/api/availability?${query}`, { headers }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), headers.origin);
    assert.deepEqual((await response.json()).houses, [tildaHouse,mappedHouse]);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousOrigin === undefined) delete process.env.GATEWAY_UPSTREAM_ORIGIN;
    else process.env.GATEWAY_UPSTREAM_ORIGIN = previousOrigin;
  }
});

test('gateway accepts only synthetic contacts and a house from its Tilda results', async () => {
  const previousFetch = globalThis.fetch;
  const previousOrigin = process.env.GATEWAY_UPSTREAM_ORIGIN;
  process.env.GATEWAY_UPSTREAM_ORIGIN = upstream;
  let forwardedPost = 0;
  globalThis.fetch = async (url, options) => {
    if (options.method === 'GET') return Response.json({ houses: [tildaHouse] });
    forwardedPost++;
    assert.equal(new URL(url).pathname, '/api/requests');
    return Response.json({ requestId: 'synthetic-id', contacts: { phone: 'tel:+79999999999' },
      message: 'A real request was received.' }, { status: 201 });
  };
  const payload = { houseId: tildaHouse.id, checkIn: '2026-10-20', checkOut: '2026-10-22', guestCount: 2,
    clientName: 'Тестовый Гость', clientPhone: '+70000000000', consent: true,
    privacyPolicyUrl: `${gateway}/test-policy` };
  const makeRequest = data => new Request(`${gateway}/api/requests`, { method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify(data) });
  try {
    assert.equal((await POST(makeRequest({ ...payload, clientName: 'Настоящий клиент' }))).status, 400);
    assert.equal(forwardedPost, 0);
    const response = await POST(makeRequest(payload));
    assert.equal(response.status, 201);
    assert.equal(forwardedPost, 1);
    const result = await response.json();
    assert.equal(result.contacts.phone, null);
    assert.match(result.message, /Тестовая заявка/);
    assert.equal((await POST(makeRequest({ ...payload, houseId: 'demo' }))).status, 409);
    assert.equal(forwardedPost, 1);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousOrigin === undefined) delete process.env.GATEWAY_UPSTREAM_ORIGIN;
    else process.env.GATEWAY_UPSTREAM_ORIGIN = previousOrigin;
  }
});
