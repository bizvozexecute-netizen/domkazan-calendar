import {test,expect,type BrowserContext} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {fixtureProduct} from './journey-fixture';

const origin='https://45.147.31.241';
async function fixture(context:BrowserContext, path='https://domkazan116.ru/'){
  const snippet=(await readFile('integration/tilda-70446131-t123.html','utf8')).replace(/<link rel="preconnect"[^>]*>/g,'');
  await context.route(path,route=>route.fulfill({contentType:'text/html; charset=utf-8',body:`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="allrecords" data-tilda-page-id="70446131"><div id="rec1088252761" class="r" data-screen-max="980">Main menu</div><div id="rec1184803096" class="r">${snippet}</div><div id="rec1096886496" class="r">Main hero</div><div id="fallback" class="r">Original catalog</div><div id="rec4148990801" class="r"><a href="/calendar-test-311744409?house=111111111111">Old test details</a></div></div>`}));
  await context.route(`${origin}/embed/*.js*`,async route=>route.fulfill({contentType:'application/javascript',body:await readFile(`public/embed/${new URL(route.request().url()).pathname.split('/').at(-1)}`,'utf8')}));
  await context.route(`${origin}/api/catalog`,route=>route.fulfill({json:{products:[fixtureProduct]}}));
  await context.route(`${origin}/embed/domkazan-catalog-initial.json`,route=>route.fulfill({json:{products:[fixtureProduct]}}));
  await context.route(`${origin}/api/client-settings`,route=>route.fulfill({json:{testEnvironment:false,contacts:{phone:'tel:+70000000000'}}}));
  await context.route('https://static.tildacdn.com/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'}));
}

test('working bootstrap uses production mode, keeps header and restores filtered catalog after details',async({page,context})=>{
  await fixture(context);
  await page.goto('https://domkazan116.ru/');
  await expect(page.locator('.cards article')).toHaveCount(1);
  const catalogScript=page.locator('script[src*="/embed/domkazan-catalog.js"]');
  await expect(catalogScript).toHaveAttribute('src',/\?v=nav-20261026(?:&retry=1)?$/);
  await expect(page.getByText('Main menu',{exact:true})).toBeVisible();
  await expect(page.getByText('Main hero',{exact:true})).toBeVisible();
  const hero=await page.locator('#rec1096886496').boundingBox();
  const catalog=await page.locator('#rec1184803096').boundingBox();
  expect(hero!.y+hero!.height).toBeLessThanOrEqual(catalog!.y+1);
  await expect(page.getByText('Original catalog',{exact:true})).toBeHidden();
  await expect(page.getByText('Тестовый стенд',{exact:false})).toHaveCount(0);
  await expect(page.getByRole('link',{name:'Политика обработки персональных данных',exact:true})).toHaveAttribute('href',origin+'/privacy-2026-10-26.html');
  await page.getByLabel('Гостей',{exact:true}).fill('7');
  await page.locator('.details-link').click();
  await expect(page.getByText('Main hero',{exact:true})).toBeHidden();
  await expect(page.getByRole('heading',{name:fixtureProduct.name,exact:true})).toBeVisible();
  await page.goBack();
  await expect(page.locator('.cards article')).toHaveCount(1);
  await expect(page.getByLabel('Гостей',{exact:true})).toHaveValue('7');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test('working bootstrap stays inert on the isolated test path',async({page,context})=>{
  const path='https://domkazan116.ru/calendar-test-311744409';
  await fixture(context,path);let calls=0;
  await context.route(`${origin}/**`,route=>{calls++;return route.abort();});
  await page.goto(path);
  expect(calls).toBe(0);
  await expect(page.getByText('Original catalog',{exact:true})).toBeVisible();
});

test('production asset outage restores the original catalog and header',async({page,context})=>{
  await fixture(context);
  await context.route(`${origin}/embed/domkazan-search.js*`,route=>route.abort());
  await page.goto('https://domkazan116.ru/');
  await expect(page.getByRole('button',{name:'Повторить загрузку',exact:true})).toBeVisible();
  await expect(page.getByText('Original catalog',{exact:true})).toBeVisible();
  await expect(page.locator('#rec1088252761')).toHaveAttribute('data-screen-max','980');
  await expect(page.locator('#rec4148990801 a')).toHaveAttribute('href','tel:+79053106605');
  await expect(page.locator('#rec4148990801 a')).toHaveText('Уточнить по телефону');
});
