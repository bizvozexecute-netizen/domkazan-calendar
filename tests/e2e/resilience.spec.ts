import {test,expect} from '@playwright/test';
import {fixtureOrigin,fixtureProduct,fixtureHouses,fixtureDay,journeyFixture,openFixtureHouse} from './journey-fixture';
import {selectStay} from './stay-helper';

test.beforeEach(async({context})=>journeyFixture(context));

test('catalog and detail navigation never reloads Tilda or flashes its hero, including browser history',async({context,page})=>{
  const products=Array.from({length:5},(_,i)=>({...fixtureProduct,productUid:String(111111111111+i),slug:`tilda-${111111111111+i}`,name:`Вымышленный дом ${i+1}`}));
  await context.route(`${fixtureOrigin}/api/catalog`,route=>route.fulfill({json:{products}}));
  await context.route(`${fixtureOrigin}/api/availability?*`,route=>route.fulfill({json:{houses:products.map(product=>({...fixtureHouses[0],id:product.slug,slug:product.slug,name:product.name}))}}));
  await page.emulateMedia({reducedMotion:'reduce'});
  let documents=0;
  await context.route('**/navigation-fixture*',route=>{documents++;return route.fulfill({contentType:'text/html; charset=utf-8',body:`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}#hero{height:500px;background:red}.ready #hero{display:none}</style><div id="original-tilda"><div id="hero">Original Tilda hero</div><div id="catalog"></div></div><script src="/embed/domkazan-search.js"></script><script src="/embed/domkazan-catalog.js"></script><script>document.getElementById('catalog').addEventListener('domkazan:ready',()=>document.getElementById('original-tilda').classList.add('ready'));DomKazanCatalog.mount({root:document.getElementById('catalog'),apiOrigin:'${fixtureOrigin}',pagePath:'/navigation-fixture'});</script>`});});
  await page.goto(`/navigation-fixture?checkIn=${fixtureDay(2)}&checkOut=${fixtureDay(4)}&guests=2&amenities=pool&sort=price`);await expect(page.locator('.cards article:visible')).toHaveCount(5);await expect(page.locator('#hero')).toBeHidden();
  const title=page.getByRole('link',{name:'Вымышленный дом 5',exact:true});await title.scrollIntoViewIfNeeded();
  const before=await page.evaluate(()=>scrollY);
  await title.click();await expect(page.getByRole('heading',{name:'Вымышленный дом 5',level:1})).toBeVisible();
  await expect(page.locator('[data-domkazan-transition]')).toHaveCount(0);expect(await page.evaluate(()=>scrollY)).toBe(0);
  await page.getByRole('link',{name:'← К результатам поиска',exact:true}).click();
  await expect(page.locator('.cards article')).toHaveCount(5);await expect(page.locator('[data-domkazan-transition]')).toHaveCount(0);
  expect(Math.abs(await page.evaluate(()=>scrollY)-before)).toBeLessThan(3);await expect(title).toBeFocused();
  // A new explicit search should show its results, not restore the old card again.
  await page.getByRole('button',{name:'Показать свободные дома',exact:true}).click();
  await expect(page.locator('.search form[aria-busy]')).toHaveAttribute('aria-busy','false');
  await expect(page.locator('.toolbar')).toBeInViewport({ratio:0.9});
  await expect(page).toHaveTitle('Каталог домов — DomKazan, тест');
  await page.goBack();await expect(page.getByRole('heading',{name:'Вымышленный дом 5',level:1})).toBeVisible();
  await page.goBack();await expect(page.locator('.cards article')).toHaveCount(5);await expect(page.locator('[data-domkazan-transition]')).toHaveCount(0);
  await page.goForward();await expect(page.getByRole('heading',{name:'Вымышленный дом 5',level:1})).toBeVisible();
  await expect(page.locator('#hero')).toBeHidden();expect(documents).toBe(1);
});

test('a malformed date link can be corrected without JavaScript errors',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`/resilience-fixture?house=${fixtureProduct.productUid}&checkIn=not-a-date&checkOut=${fixtureDay(4)}&guests=2`);
  await expect(page.getByRole('heading',{name:fixtureProduct.name,level:1})).toBeVisible();
  // Recover into a later month too; this must work on the last days of a month.
  await selectStay(page,fixtureDay(40),fixtureDay(42));
  await page.getByRole('button',{name:'Проверить стоимость',exact:true}).click();
  await expect(page.getByRole('button',{name:`Оставить заявку: ${fixtureProduct.name}`})).toBeVisible();expect(errors).toEqual([]);
});

test('gallery loads full photos, follows active thumbnail, supports zoom keyboard, swipe and safe video exit',async({page},testInfo)=>{
  await openFixtureHouse(page);
  const photo=page.locator('.gallery .photo-button img');
  await expect(photo).toHaveClass('loaded');await expect(photo).toHaveCSS('object-fit','cover');
  await page.getByRole('button',{name:'Фото 14',exact:true}).click();
  await expect(photo).toHaveClass('loaded');
  const thumb=await page.getByRole('button',{name:'Фото 14',exact:true}).boundingBox();const rail=await page.locator('.thumbnails').boundingBox();
  expect(thumb!.x).toBeGreaterThanOrEqual(rail!.x-1);expect(thumb!.x+thumb!.width).toBeLessThanOrEqual(rail!.x+rail!.width+1);
  await page.getByRole('button',{name:'Увеличить фото',exact:true}).click();
  const zoom=page.getByRole('dialog',{name:'Увеличенное фото',exact:true});await expect(zoom).toBeVisible();
  await expect(zoom.locator('img')).toHaveCSS('object-fit','contain');
  await page.keyboard.press('ArrowRight');await expect(zoom.locator('img')).toHaveAttribute('src',fixtureProduct.images[0]);
  await page.keyboard.press('ArrowLeft');await expect(zoom.locator('img')).toHaveAttribute('src',fixtureProduct.images[13]);
  await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Увеличить фото',exact:true})).toBeFocused();
  await page.getByRole('button',{name:'Фото 1',exact:true}).click();
  // Exercise the same pointer stream on touch and mouse projects without CDP-only APIs.
  const viewer=page.getByLabel('Галерея дома',{exact:true});
  await viewer.dispatchEvent('pointerdown',{pointerType:'touch',clientX:250,clientY:100});
  await viewer.dispatchEvent('pointerup',{pointerType:'touch',clientX:100,clientY:105});
  await expect(page.getByRole('button',{name:'Фото 2',exact:true})).toHaveAttribute('aria-current','true');
  await expect(zoom).toBeHidden();
  await page.getByRole('button',{name:'Видео Rutube',exact:true}).click();
  const iframe=page.locator('iframe[title="Видео дома на Rutube"]');await expect(iframe).toHaveAttribute('src',/embed\/a{32}\/$/);
  await expect(iframe).not.toHaveAttribute('allow',/autoplay/);
  await expect(page.getByRole('link',{name:'Открыть видео в Rutube ↗',exact:true})).toHaveAttribute('rel','noopener noreferrer');
  await page.getByRole('button',{name:'Фото 1',exact:true}).click();await expect(iframe).toHaveCount(0);
  const booking=await page.getByRole('complementary',{name:'Стоимость и заявка'}).boundingBox();const description=await page.locator('.house-copy').boundingBox();
  if((testInfo.project.use.viewport?.width??1280)<=760)expect(booking!.y+booking!.height).toBeLessThanOrEqual(description!.y);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test('broken image has a usable retry instead of a blank gallery',async({context,page})=>{
  let failed=true;
  await context.route(fixtureProduct.images[0],route=>failed?route.abort('failed'):route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"/>'}));
  await openFixtureHouse(page);await expect(page.getByRole('button',{name:'Повторить загрузку фото',exact:true})).toBeVisible();
  failed=false;await page.getByRole('button',{name:'Повторить загрузку фото',exact:true}).click();
  await expect(page.locator('.gallery .photo-button img')).toHaveClass('loaded');await expect(page.getByText('Фото временно недоступно.',{exact:true})).toHaveCount(0);
});

test('request timeout releases submit safely and preserves the idempotent retry',async({context,page})=>{
  await page.clock.install();let calls=0;
  await context.route(`${fixtureOrigin}/api/requests`,()=>{calls++;return new Promise(()=>{});});
  await openFixtureHouse(page);await page.getByRole('button',{name:'Оставить заявку: Вымышленный дом'}).click();
  await page.getByRole('checkbox',{name:/Согласен на обработку/}).check();await page.getByRole('button',{name:'Отправить заявку',exact:true}).click();
  await expect(page.locator('.request-form')).toHaveAttribute('aria-busy','true');
  await page.clock.fastForward(16000);await expect(page.getByRole('button',{name:'Повторить эту же заявку',exact:true})).toBeEnabled();
  await expect(page.locator('.request-form')).toHaveAttribute('aria-busy','false');expect(calls).toBe(1);
});

test('catalog failure replaces loading, reload recovers and unknown house has a way back',async({context,page})=>{
  let unavailable=true;
  await context.route(`${fixtureOrigin}/api/catalog`,route=>unavailable?route.fulfill({status:503,json:{error:'Unavailable'}}):route.fulfill({json:{products:[fixtureProduct]}}));
  await page.goto('/resilience-fixture');await expect(page.getByText('Загружаем каталог домов…')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Загрузить каталог повторно'})).toBeVisible();unavailable=false;
  await page.getByRole('button',{name:'Загрузить каталог повторно'}).click();await expect(page.locator('.cards article')).toHaveCount(1);
  await page.goto('/resilience-fixture?house=999999999999');await expect(page.getByRole('heading',{name:'Дом не найден'})).toBeVisible();
  await page.getByRole('link',{name:'← Все дома',exact:true}).click();await expect(page.locator('.cards article')).toHaveCount(1);
});

test('search failure recovers, changes during flight discard old results and require a new search',async({context,page})=>{
  let mode='error';let release:()=>void=()=>{};
  await context.route(`${fixtureOrigin}/api/availability?*`,async route=>{
    if(mode==='slow')await new Promise<void>(resolve=>{release=resolve;});
    await route.fulfill(mode==='error'?{status:503,json:{error:'Поиск временно недоступен.'}}:{json:{houses:fixtureHouses}}).catch(()=>{});
  });
  await openFixtureHouse(page);await expect(page.getByText('Поиск временно недоступен.',{exact:true})).toBeVisible();
  mode='slow';await page.getByRole('button',{name:'Проверить стоимость',exact:true}).click();await expect(page.locator('form[aria-busy=true]')).toBeVisible();
  await page.getByLabel('Гостей',{exact:true}).fill('3');mode='ok';release();
  await expect(page.locator('[data-domkazan-action-for]')).toHaveCount(0);await expect(page.getByText('Параметры изменились. Повторите поиск.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Проверить стоимость',exact:true}).click();await expect(page.getByRole('button',{name:'Оставить заявку: Вымышленный дом'})).toBeVisible();
});

test('consent, ambiguous request retry, immutable payload and stale receipt prevent duplicate or old requests',async({context,page})=>{
  const payloads:unknown[]=[];let release:()=>void=()=>{};
  await context.route(`${fixtureOrigin}/api/requests`,async route=>{payloads.push(route.request().postDataJSON());
    if(payloads.length===1)return route.fulfill({status:503,json:{error:'Temporary failure'}});
    await new Promise<void>(resolve=>{release=resolve;});return route.fulfill({status:201,json:{requestId:'synthetic-retry',message:'Получена',contacts:{}}});});
  await openFixtureHouse(page);await page.getByRole('button',{name:'Оставить заявку: Вымышленный дом'}).click();
  await page.getByRole('button',{name:'Отправить заявку',exact:true}).click();expect(payloads).toHaveLength(0);
  await page.getByRole('checkbox',{name:/Согласен на обработку/}).check();await page.getByRole('button',{name:'Отправить заявку',exact:true}).click();
  const retry=page.getByRole('button',{name:'Повторить эту же заявку',exact:true});await expect(retry).toBeEnabled();await expect(page.getByLabel('Телефон',{exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Оставить заявку: Вымышленный дом'}).click();await expect(retry).toBeFocused();
  await retry.click();await expect(retry).toBeDisabled();expect(payloads).toHaveLength(2);expect(payloads[1]).toEqual(payloads[0]);
  expect(payloads[0]).not.toHaveProperty('total');expect(payloads[0]).not.toHaveProperty('status');
  await page.getByLabel('Гостей',{exact:true}).fill('4');release();
  await expect(page.getByText(/Заявка synthetic-retry получена для прежних параметров/)).toBeVisible();
  await expect(page.getByRole('form',{name:'Заявка на проживание'})).toBeHidden();await expect(page.locator('[data-domkazan-action-for]')).toHaveCount(0);
});

test('availability conflict removes stale request and keeps checkout on the next occupied night valid',async({context,page})=>{
  await context.route(`${fixtureOrigin}/api/requests`,route=>route.fulfill({status:409,json:{error:'Занято'}}));
  await openFixtureHouse(page);await page.getByRole('button',{name:'Выезд',exact:true}).click();
  // Occupied night is a valid departure boundary; it cannot be stayed through.
  await expect(page.locator(`[data-day="${fixtureDay(5)}"]`)).toBeEnabled();await expect(page.locator(`[data-day="${fixtureDay(6)}"]`)).toBeDisabled();
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'Оставить заявку: Вымышленный дом'}).click();
  await page.getByRole('checkbox',{name:/Согласен на обработку/}).check();await page.getByRole('button',{name:'Отправить заявку',exact:true}).click();
  await expect(page.getByText('Доступность дома изменилась. Повторите поиск перед новой заявкой.',{exact:true})).toBeVisible();
  await expect(page.locator('[data-domkazan-action-for]')).toHaveCount(0);
});
