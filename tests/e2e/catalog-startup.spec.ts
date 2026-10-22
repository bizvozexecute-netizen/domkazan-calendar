import {test,expect,type BrowserContext} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {fixtureProduct,fixtureHouses} from './journey-fixture';
const origin='https://domkazan-calendar-tilda-test-gatewa.vercel.app';
const testUrl='https://domkazan116.ru/calendar-test-311744409';
const deferred=()=>{let release!:()=>void;const promise=new Promise<void>(resolve=>{release=resolve;});return{promise,release};};

async function fixture(context:BrowserContext,path=testUrl){
  const snippet=(await readFile('integration/tilda-311744409-t123.html','utf8')).replace(/(<script id="domkazan-catalog-initial" type="application\/json">)[\s\S]*?(<\/script>)/,`$1${JSON.stringify({products:[fixtureProduct]})}$2`);
  await context.route(path,route=>route.fulfill({contentType:'text/html; charset=utf-8',body:`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script defer src="/unrelated.js"></script><div id="allrecords" data-tilda-page-id="311744409"><div id="rec4862082401" class="r" data-screen-max="980">Old menu</div><div id="rec4862390501" class="r">${snippet}</div><div id="fallback" class="r">Original catalog</div></div><script>document.addEventListener('DOMContentLoaded',()=>{const menu=document.getElementById('rec4862082401');window.menuObserverStarted=!(menu.dataset.screenMax&&innerWidth>Number(menu.dataset.screenMax));if(window.menuObserverStarted)new ResizeObserver(()=>{}).observe(document.body);});</script>`}));
  await context.route(`${origin}/embed/*.js`,async route=>route.fulfill({contentType:'application/javascript',body:await readFile(`public/embed/${new URL(route.request().url()).pathname.split('/').at(-1)}`,'utf8')}));
  await context.route('https://static.tildacdn.com/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'}));
  await context.route(`${origin}/api/catalog`,route=>route.fulfill({json:{products:[fixtureProduct]}}));
  await context.route(`${origin}/api/availability?*`,route=>route.fulfill({json:{houses:fixtureHouses}}));
}

test('cold startup starts both modules and content together, before unrelated DOM readiness',async({page,context})=>{
  await fixture(context);const held=deferred(),unrelated=deferred();const starts=new Set<string>();let catalogCalls=0;
  await context.addInitScript(()=>Object.assign(window,{originalResizeObserver:ResizeObserver}));
  await context.route('**/unrelated.js',async route=>{await unrelated.promise;await route.fulfill({body:''});});
  for(const name of ['domkazan-search.js','domkazan-catalog.js'])await context.route(`${origin}/embed/${name}`,async route=>{starts.add(name);await held.promise;await route.fulfill({contentType:'application/javascript',body:await readFile(`public/embed/${name}`,'utf8')});});
  await context.route(`${origin}/api/catalog`,async route=>{catalogCalls++;starts.add('catalog');await held.promise;await route.fulfill({json:{products:[fixtureProduct]}});});
  try{
    await page.goto(testUrl,{waitUntil:'commit'});
    await expect.poll(()=>starts.size).toBe(3);
    expect(await page.evaluate(()=>document.readyState)).not.toBe('complete');
    await expect(page.locator('#fallback')).toBeHidden();await expect(page.locator('#rec4862082401')).toHaveAttribute('data-screen-max','0');
    held.release();await expect(page.locator('.cards article')).toHaveCount(1);
    expect(catalogCalls).toBe(1);expect(await page.evaluate(()=>document.readyState)).not.toBe('complete');
    unrelated.release();await page.waitForLoadState('domcontentloaded');
    expect(await page.evaluate(()=>({started:(window as unknown as {menuObserverStarted:boolean}).menuObserverStarted,native:ResizeObserver===(window as unknown as {originalResizeObserver:typeof ResizeObserver}).originalResizeObserver}))).toEqual({started:false,native:true});
    // A cached description never substitutes for a fresh availability request.
    await expect(page.getByRole('button',{name:'Показать свободные дома'})).toBeVisible();
  }finally{held.release();unrelated.release();}
});

test('a stalled metadata origin cannot block first paint or fail the ready catalog',async({page,context})=>{
  await fixture(context);const api=deferred();const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/unrelated.js',route=>route.fulfill({body:''}));
  await context.route(`${origin}/api/catalog`,async route=>{await api.promise;await route.fulfill({status:503,json:{error:'Synthetic outage'}}).catch(()=>{});});
  await page.clock.install();
  try{
    await page.goto(testUrl);await expect(page.locator('.cards article')).toHaveCount(1);
    await page.clock.fastForward(11000);await expect(page.locator('#allrecords')).toHaveClass('dkcal-ready');
    await expect(page.locator('#fallback')).toBeHidden();await expect(page.getByRole('button',{name:'Показать свободные дома'})).toBeVisible();
    expect(errors).toEqual([]);
  }finally{api.release();}
});

test('background metadata refresh preserves active fields and is used on the next house view',async({page,context})=>{
  await fixture(context);const api=deferred();await context.route('**/unrelated.js',route=>route.fulfill({body:''}));
  await context.route(`${origin}/api/catalog`,async route=>{await api.promise;await route.fulfill({json:{products:[{...fixtureProduct,name:'Обновлённое название'}]}});});
  try{
    await page.goto(testUrl);await expect(page.locator('.cards article')).toHaveCount(1);
    await page.getByLabel('Гостей',{exact:true}).fill('7');
    const refreshed=page.waitForResponse(`${origin}/api/catalog`);api.release();await refreshed;
    await expect(page.getByLabel('Гостей',{exact:true})).toHaveValue('7');
    await page.locator('.details-link').click();
    await expect(page.getByRole('heading',{name:'Обновлённое название',exact:true})).toBeVisible();
  }finally{api.release();}
});

test('startup failure restores Tilda visibility and its original menu settings',async({page,context})=>{
  await fixture(context);await context.route('**/unrelated.js',route=>route.fulfill({body:''}));
  await context.route(`${origin}/embed/domkazan-search.js`,route=>route.abort());
  await page.goto(testUrl);await expect(page.getByRole('button',{name:'Повторить загрузку',exact:true})).toBeVisible();
  await expect(page.locator('#fallback')).toBeVisible();await expect(page.locator('#rec4862082401')).toHaveAttribute('data-screen-max','980');
  await expect(page.locator('#allrecords')).not.toHaveClass(/dkcal-(pending|ready)/);
});

test('bootstrap has no effect on a working page with the same block IDs',async({page,context})=>{
  const working='https://domkazan116.ru/';await fixture(context,working);let calls=0;
  await context.route(`${origin}/**`,route=>{calls++;return route.abort();});await context.route('**/unrelated.js',route=>route.fulfill({body:''}));
  await page.goto(working);expect(calls).toBe(0);await expect(page.locator('#fallback')).toBeVisible();await expect(page.locator('#rec4862082401')).toHaveAttribute('data-screen-max','980');
});
