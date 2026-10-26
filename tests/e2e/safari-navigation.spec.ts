import {test,expect} from '@playwright/test';
import {journeyFixture,fixtureOrigin,fixtureProduct,fixtureDay} from './journey-fixture';

test.beforeEach(async({context})=>{await journeyFixture(context);});

for(const selector of ['.cover','h2 a','.details-link']){
  test(`house link ${selector} preserves search and browser return`,async({page,isMobile})=>{
    const search=`?checkIn=${fixtureDay(2)}&checkOut=${fixtureDay(4)}&guests=2&amenities=pool&sort=default`;
    await page.goto(`${fixtureOrigin}/resilience-fixture${search}`);
    const link=page.locator('#catalog').locator(selector).first();
    await expect(link).toBeVisible();
    if(isMobile)await link.tap();else await link.click();
    await expect(page.locator('h1')).toHaveText(fixtureProduct.name);
    expect(new URL(page.url()).searchParams.get('house')).toBe(fixtureProduct.productUid);
    for(const [key,value] of new URLSearchParams(search))expect(new URL(page.url()).searchParams.get(key)).toBe(value);
    await expect(page.locator('[data-domkazan-transition]')).toHaveCount(0);
    await expect(page.locator('#catalog')).not.toHaveAttribute('inert','');
    await page.goBack();
    await expect(page.locator('.details-link')).toBeVisible();
    expect(new URL(page.url()).searchParams.has('house')).toBe(false);
    expect(new URL(page.url()).searchParams.get('guests')).toBe('2');
  });
}

test('a failed History API falls back to the ordinary house URL',async({page})=>{
  await page.goto(`${fixtureOrigin}/resilience-fixture?guests=2`);
  await expect(page.locator('.details-link')).toBeVisible();
  await page.evaluate(()=>{history.pushState=()=>{throw new DOMException('Unavailable','SecurityError');};});
  await page.locator('.details-link').click();
  await expect(page.locator('h1')).toHaveText(fixtureProduct.name);
  expect(new URL(page.url()).searchParams.get('house')).toBe(fixtureProduct.productUid);
  await expect(page.locator('[data-domkazan-transition]')).toHaveCount(0);
  await expect(page.locator('#catalog')).not.toHaveAttribute('inert','');
});

test('scroll restoration failure cannot leave the house inert',async({page})=>{
  await page.goto(`${fixtureOrigin}/resilience-fixture`);
  await expect(page.locator('.details-link')).toBeVisible();
  await page.evaluate(()=>{window.scrollTo=()=>{throw new TypeError('Unsupported scroll options');};});
  await page.locator('.details-link').click();
  await expect(page.locator('h1')).toHaveText(fixtureProduct.name);
  await expect(page.locator('[data-domkazan-transition]')).toHaveCount(0);
  await expect(page.locator('#catalog')).not.toHaveAttribute('inert','');
  await expect(page.locator('.back')).toBeVisible();
});

test('compatibility click without mouse fields or composedPath still navigates',async({page})=>{
  await page.goto(`${fixtureOrigin}/resilience-fixture?guests=3`);
  await expect(page.locator('.details-link')).toBeVisible();
  await page.locator('.details-link').evaluate(anchor=>{
    const event=new Event('click',{bubbles:true,composed:true,cancelable:true});
    Object.defineProperty(event,'composedPath',{value:undefined});
    anchor.dispatchEvent(event);
  });
  await expect(page.locator('h1')).toHaveText(fixtureProduct.name);
  expect(new URL(page.url()).searchParams.get('guests')).toBe('3');
  await expect(page.locator('[data-domkazan-transition]')).toHaveCount(0);
});

test('touch compatibility click with button -1 opens a house',async({page})=>{
  await page.goto(`${fixtureOrigin}/resilience-fixture`);
  await expect(page.locator('.details-link')).toBeVisible();
  await page.locator('.details-link').dispatchEvent('click',{button:-1,pointerType:'mouse'});
  await expect(page.locator('h1')).toHaveText(fixtureProduct.name);
  await expect(page.locator('[data-domkazan-transition]')).toHaveCount(0);
});

test('a click confined to the shadow tree still opens the house',async({page})=>{
  await page.goto(`${fixtureOrigin}/resilience-fixture`);
  await expect(page.locator('.details-link')).toBeVisible();
  await page.locator('.details-link').evaluate(anchor=>anchor.dispatchEvent(new MouseEvent('click',{button:0,bubbles:true,composed:false,cancelable:true})));
  await expect(page.locator('h1')).toHaveText(fixtureProduct.name);
  await expect(page.locator('[data-domkazan-transition]')).toHaveCount(0);
});

test('a stalled transition falls back once instead of keeping the catalog locked',async({page})=>{
  await page.clock.install();
  let documents=0;page.on('request',request=>{if(request.isNavigationRequest()&&request.frame()===page.mainFrame())documents++;});
  await page.goto(`${fixtureOrigin}/resilience-fixture`);
  await expect(page.locator('.details-link')).toBeVisible();
  await page.locator('#catalog').evaluate(root=>root.addEventListener('domkazan:view-ready',event=>event.stopImmediatePropagation(),true));
  await page.locator('.details-link').click();
  await expect(page.locator('[data-domkazan-transition]')).toHaveCount(1);
  await page.clock.fastForward(16000);
  await expect(page.locator('h1')).toHaveText(fixtureProduct.name);
  await expect(page.locator('[data-domkazan-transition]')).toHaveCount(0);
  await expect(page.locator('#catalog')).not.toHaveAttribute('inert','');
  expect(documents).toBe(2);
});
