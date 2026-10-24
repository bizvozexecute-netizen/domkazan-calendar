import {test,expect} from '@playwright/test';
import {fixtureOrigin,fixtureProduct,fixtureDay,journeyFixture,openFixtureHouse} from './journey-fixture';
import {CLIENT_UI_DEFAULTS,contrast} from '../../src/lib/client-ui';

test.beforeEach(async({context})=>journeyFixture(context));

test('first arrival is visibly selected, ranges cross months and can be chosen again',async({page},testInfo)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/resilience-fixture');
  await page.getByRole('button',{name:'Заезд',exact:true}).click();
  const now=new Date();const arrival=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,0)).toISOString().slice(0,10);
  const departure=new Date(Date.parse(arrival)+2*86400000).toISOString().slice(0,10);
  const start=page.locator(`[data-day="${arrival}"]`);await start.click();
  await expect(start).toHaveAttribute('aria-pressed','true');
  await expect(start).toHaveCSS('background-color','rgb(22, 91, 196)');
  await expect(start).toHaveCSS('color','rgb(255, 255, 255)');
  await expect(page.getByText('Выберите выезд',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Следующий месяц',exact:true}).click();
  await page.locator(`[data-day="${departure}"]`).click();
  await expect(page.getByRole('dialog',{name:'Выбор дат проживания'})).toBeHidden();
  await page.getByRole('button',{name:'Заезд',exact:true}).click();
  await expect(start).toHaveClass('in-range');
  await page.getByRole('button',{name:'Следующий месяц',exact:true}).click();
  const interior=new Date(Date.parse(arrival)+86400000).toISOString().slice(0,10);
  await expect(page.locator(`[data-day="${interior}"]`)).toHaveClass('in-range');
  await expect(page.locator(`[data-day="${departure}"]`)).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'Предыдущий месяц',exact:true}).click();
  await start.click();await expect(start).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('[name=checkOut]')).toHaveValue('');
  await start.click();await expect(page.getByText('Выберите выезд',{exact:true})).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Заезд',exact:true})).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  expect(errors).toEqual([]);
  await page.getByRole('button',{name:'Заезд',exact:true}).click();
  await page.screenshot({path:testInfo.outputPath('arrival-selected.png')});
});

test('agreed colors and texts reach catalog, gallery and request form with accessible actions',async({page,context},testInfo)=>{
  const settings=structuredClone(CLIENT_UI_DEFAULTS);
  settings.colors.primary='#164C9A';settings.colors.background='#F6F8FA';
  settings.texts.videoButton='Посмотреть видео';settings.texts.requestTitle='Запрос владельцу';settings.texts.quoteButton='Рассчитать поездку';
  await context.route(`${fixtureOrigin}/api/client-settings`,route=>route.fulfill({json:{...settings,contacts:{phone:'tel:+70000000000',telegram:'https://t.me/example_owner',whatsapp:'https://wa.me/70000000000'}}}));
  await openFixtureHouse(page);
  const video=page.getByRole('button',{name:'Перейти к видео дома',exact:true});
  await expect(video).toHaveText('Посмотреть видео');
  await expect(page.getByRole('button',{name:'Рассчитать поездку',exact:true})).toBeVisible();
  for(const [action,border] of [[video,'rgb(22, 76, 154)'],[page.getByRole('link',{name:'Позвонить',exact:true}),'rgb(22, 76, 154)'],[page.getByRole('link',{name:'Telegram',exact:true}),'rgb(23, 101, 181)'],[page.getByRole('link',{name:'WhatsApp',exact:true}),'rgb(20, 108, 60)']] as const){
    const box=await action.boundingBox();expect(box?.height).toBeGreaterThanOrEqual(48);
    await expect(action).toHaveCSS('border-top-color',border);
    await action.hover();
    const color=await action.evaluate(node=>{const value=getComputedStyle(node);return {fg:value.color,bg:value.backgroundColor};});
    const hex=(rgb:string)=>'#'+rgb.match(/\d+/g)!.slice(0,3).map(n=>Number(n).toString(16).padStart(2,'0')).join('');
    expect(contrast(hex(color.fg),hex(color.bg))).toBeGreaterThanOrEqual(4.5);
  }
  // :focus-visible follows the input modality. Exercise keyboard navigation
  // rather than assuming programmatic focus after pointer input is visible.
  await video.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');
  await expect(video).toBeFocused();await expect(video).toHaveCSS('outline-style','solid');
  await page.getByRole('button',{name:`Оставить заявку: ${fixtureProduct.name}`,exact:true}).click();
  await expect(page.getByRole('form',{name:'Запрос владельцу',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Запрос владельцу',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('actions-and-form.png')});
});

test('house rejection reasons remain distinct and technical errors stay private',async({page,context})=>{
  let reason:Record<string,unknown>={code:'CAPACITY',maxGuests:4};let fail=false;
  await context.route(`${fixtureOrigin}/api/availability?*`,route=>fail?route.fulfill({status:500,json:{error:'SQL password=secret stack trace'}}):route.fulfill({json:{houses:[],unavailability:reason}}));
  await page.goto(`/resilience-fixture?house=${fixtureProduct.productUid}&checkIn=${fixtureDay(2)}&checkOut=${fixtureDay(4)}&guests=8`);
  const status=page.locator('.message[data-state=error]');
  await expect(status).toContainText('Максимальная вместимость дома — 4 гостя');
  for(const [code,text] of [['OCCUPIED','Дом занят на выбранные даты'],['UNPRICED','тариф ещё не установлен'],['MIN_NIGHTS','минимальный срок проживания — 3 ночи']]){
    reason={code,minNights:3};await page.getByRole('button',{name:'Проверить стоимость',exact:true}).click();
    await expect(status).toContainText(text);await expect(page.locator('[data-domkazan-action-for]')).toHaveCount(0);
  }
  fail=true;await page.getByRole('button',{name:'Проверить стоимость',exact:true}).click();
  await expect(status).toHaveText(CLIENT_UI_DEFAULTS.texts.searchError);
  await expect(status).not.toContainText('SQL');
});

test('a settings outage uses safe defaults and does not prevent search',async({page,context})=>{
  await context.route(`${fixtureOrigin}/api/client-settings`,route=>route.fulfill({status:503,json:{error:'private'}}));
  await openFixtureHouse(page);await expect(page.getByRole('button',{name:'Проверить стоимость',exact:true})).toBeVisible();
  await expect(page.getByText('Дом свободен на выбранные даты.',{exact:true})).toBeVisible();
});
