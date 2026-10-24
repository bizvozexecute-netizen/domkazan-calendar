import {readFile} from 'node:fs/promises';
import type {BrowserContext,Page} from '@playwright/test';

export const fixtureOrigin='https://journey.example.invalid';
export const fixtureDay=(offset:number)=>new Date(Date.now()+offset*86400000).toISOString().slice(0,10);
export const fixtureProduct={productUid:'111111111111',slug:'tilda-111111111111',name:'Вымышленный дом',maxGuests:12,bedrooms:3,beds:6,
  amenities:['pool','sauna'],images:Array.from({length:14},(_,i)=>`https://static.tildacdn.com/fixture-${i}.svg`),
  facts:'Синтетический текст',description:'Полное тестовое описание. '.repeat(70),publicBaseRates:{weekday:5000},rutubeUrl:'https://rutube.ru/video/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/'};
export const fixtureHouses=[{id:fixtureProduct.slug,slug:fixtureProduct.slug,name:fixtureProduct.name,quote:{total:'10000',nights:2}}];
export async function journeyFixture(context:BrowserContext){
  await context.route('**/resilience-fixture*',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}</style><div id="catalog"></div><script src="/embed/domkazan-search.js"></script><script src="/embed/domkazan-catalog.js"></script><script>DomKazanCatalog.mount({root:document.getElementById('catalog'),apiOrigin:'${fixtureOrigin}',privacyUrl:'https://example.invalid/privacy',pagePath:'/resilience-fixture'});</script>`}));
  await context.route('**/embed/*.js',async route=>route.fulfill({contentType:'application/javascript',body:await readFile(`public/embed/${new URL(route.request().url()).pathname.split('/').at(-1)}`,'utf8')}));
  await context.route('https://static.tildacdn.com/fixture-*.svg*',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="300" height="400" fill="#ddebe3"/></svg>'}));
  await context.route('https://rutube.ru/play/embed/**',route=>route.fulfill({contentType:'text/html',body:'<p>Isolated iframe contract fixture, not playback proof</p>'}));
  await context.route(`${fixtureOrigin}/api/catalog`,route=>route.fulfill({json:{products:[fixtureProduct]}}));
  await context.route(`${fixtureOrigin}/api/client-settings`,route=>route.fulfill({json:{}}));
  await context.route(`${fixtureOrigin}/api/availability?*`,route=>route.fulfill({json:{houses:fixtureHouses}}));
  await context.route(`${fixtureOrigin}/api/house-calendar?*`,route=>route.fulfill({json:{days:Array.from({length:90},(_,i)=>({date:fixtureDay(i),price:'5000',minNights:1,status:i===5?'occupied':'available'}))}}));
}
export async function openFixtureHouse(page:Page){
  await page.goto(`/resilience-fixture?house=${fixtureProduct.productUid}&checkIn=${fixtureDay(2)}&checkOut=${fixtureDay(4)}&guests=2`);
}
