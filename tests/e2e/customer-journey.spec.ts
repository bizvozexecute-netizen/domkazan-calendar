import {readFile} from "node:fs/promises";
import {test,expect} from "@playwright/test";
import {selectStay} from "./stay-helper";

// This suite uses synthetic contacts only; admin/auth tests never record video.
test.use({video:'on'});

const day=(offset:number)=>new Date(Date.now()+offset*86400000).toISOString().slice(0,10);
const products=["111111111111","222222222222"].map((uid,index)=>({productUid:uid,slug:`tilda-${uid}`,name:`Вымышленный дом ${index+1}`,maxGuests:12,bedrooms:3,beds:6,
  amenities:["pool","sauna"],images:["https://static.tildacdn.com/synthetic-a.svg","https://static.tildacdn.com/synthetic-b.svg"],
  facts:"Тестовый текст из Tilda",description:"Описание вымышленного дома. Единственный источник контента — Tilda.",publicBaseRates:{weekday:5000},rutubeUrl:"https://rutube.ru/video/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/"}));

test("one search, price sorting, house calendar, gallery, receipt and return preserve state",async({page,context},testInfo)=>{
  const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
  const queries:URL[]=[];
  const origin="https://catalog.example.invalid";
  await context.route("**/journey-fixture*",route=>route.fulfill({contentType:"text/html; charset=utf-8",body:`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}</style><div id="catalog"></div><script src="/embed/domkazan-search.js"></script><script src="/embed/domkazan-catalog.js"></script><script>DomKazanCatalog.mount({root:document.getElementById('catalog'),apiOrigin:'${origin}',privacyUrl:'https://example.invalid/privacy',pagePath:'/journey-fixture'});</script>`}));
  await context.route("**/embed/*.js",async route=>route.fulfill({contentType:"application/javascript",body:await readFile(`public/embed/${new URL(route.request().url()).pathname.split('/').at(-1)}`,"utf8")}));
  await context.route("https://static.tildacdn.com/synthetic-*.svg",route=>route.fulfill({contentType:"image/svg+xml",body:'<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="300" height="400" fill="#ddebe3"/></svg>'}));
  await context.route("https://rutube.ru/play/embed/**",route=>route.fulfill({contentType:"text/html",body:"<p>Synthetic video</p>"}));
  await context.route(`${origin}/api/catalog`,route=>route.fulfill({json:{products}}));
  await context.route(`${origin}/api/client-settings`,route=>route.fulfill({json:{}}));
  await context.route(`${origin}/api/availability?*`,route=>{
    const url=new URL(route.request().url());queries.push(url);
    return route.fulfill({json:{houses:products.filter(product=>!url.searchParams.get('house')||product.slug===url.searchParams.get('house')).map((product,index)=>({id:product.slug,slug:product.slug,name:product.name,quote:{total:String(10000+index*10000),nights:2}}))}});
  });
  await context.route(`${origin}/api/house-calendar?*`,route=>route.fulfill({json:{days:Array.from({length:90},(_,index)=>({date:day(index),price:index===6?null:"5000",minNights:1,status:index===5?"occupied":index===6?"unpriced":"available"}))}}));
  await context.route(`${origin}/api/requests`,route=>route.fulfill({status:201,json:{requestId:"synthetic-request",message:"Тестовая заявка получена.",contacts:{}}}));
  await page.goto("/journey-fixture");
  await expect(page.getByRole("button",{name:"Заезд",exact:true})).toBeVisible();
  await expect(page.getByLabel('Сортировать',{exact:true})).toBeDisabled();
  await selectStay(page,day(2),day(4));
  await page.getByLabel("Гостей",{exact:true}).fill("8");
  await page.getByRole("checkbox",{name:"Бассейн",exact:true}).check();
  await page.getByRole("checkbox",{name:"Баня / сауна",exact:true}).check();
  await page.getByRole("button",{name:"Показать свободные дома"}).click();
  await expect(page.getByText("Найдено домов: 2",{exact:true})).toBeVisible();
  expect(queries.length).toBe(1);expect(queries[0].searchParams.get("amenities")).toBe("pool,sauna");expect(queries[0].searchParams.get("guests")).toBe("8");
  await page.getByLabel("Сортировать",{exact:true}).selectOption("price-desc");
  expect(queries.length).toBe(1);
  await expect(page.locator('[data-domkazan-house="tilda-222222222222"]')).toHaveCSS("order","0");
  await page.screenshot({path:testInfo.outputPath("journey-catalog.png"),fullPage:true});
  await expect(page.locator('.cards > article').first()).toHaveAttribute('data-domkazan-house','tilda-222222222222');
  const first=page.getByRole("link",{name:"Вымышленный дом 1",exact:true});
  const target=new URL((await first.getAttribute("href"))!,page.url());expect(target.searchParams.get("amenities")).toBe("pool,sauna");expect(target.searchParams.get("sort")).toBe("price-desc");
  await first.scrollIntoViewIfNeeded();const catalogY=await page.evaluate(()=>scrollY);
  await first.click();
  await expect(page.getByRole("heading",{name:"Вымышленный дом 1",level:1})).toBeVisible();
  await expect(page.getByText("Дом свободен на выбранные даты.")).toBeVisible();
  await page.screenshot({path:testInfo.outputPath('journey-house-detail.png'),fullPage:true});
  await expect(page.getByText("Свободных домов: 1",{exact:true})).toHaveCount(0);
  await page.getByRole("button",{name:"Следующее фото"}).click();
  await expect(page.getByRole("button",{name:"Фото 2",exact:true})).toHaveAttribute("aria-current","true");
  await page.getByRole("button",{name:"Фото 2",exact:true}).press("ArrowLeft");
  await expect(page.getByRole("button",{name:"Фото 1",exact:true})).toHaveAttribute("aria-current","true");
  await page.getByRole("button",{name:"Фото 1",exact:true}).press("ArrowRight");
  await page.getByRole("button",{name:"Увеличить фото"}).click();await expect(page.getByRole("dialog",{name:"Увеличенное фото"})).toBeVisible();await page.keyboard.press("Escape");
  await page.getByRole("button",{name:"Видео Rutube",exact:true}).click();await expect(page.locator('iframe[title="Видео дома на Rutube"]')).toHaveAttribute('src',/rutube.ru\/play\/embed\/a{32}\//);
  await page.getByRole("button",{name:"Фото 1",exact:true}).click();
  await page.getByRole("button",{name:"Заезд",exact:true}).click();
  await expect(page.locator(`[data-day="${day(5)}"]`)).toBeDisabled();await expect(page.locator(`[data-day="${day(6)}"]`)).toBeDisabled();
  await page.screenshot({path:testInfo.outputPath('journey-calendar.png'),fullPage:true});
  await page.keyboard.press("Escape");
  // A house can be requoted independently; return still restores the catalog's search.
  await page.getByLabel('Гостей',{exact:true}).fill('9');
  await page.getByRole('button',{name:'Проверить стоимость',exact:true}).click();
  await expect(page.getByText('Дом свободен на выбранные даты.',{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Оставить заявку: Вымышленный дом 1"}).click();
  await expect(page.getByLabel('Имя',{exact:true})).toBeInViewport();
  await expect(page.locator(".summary")).toContainText(day(2).split('-').reverse().join('.'));
  await expect(page.getByLabel('Контакт мессенджера',{exact:true})).toBeHidden();
  await page.getByText('Мессенджер и комментарий · необязательно',{exact:true}).click();
  await expect(page.getByLabel('Контакт мессенджера',{exact:true})).toBeVisible();
  await page.getByText('Мессенджер и комментарий · необязательно',{exact:true}).click();
  await page.getByRole("checkbox",{name:/Согласен на обработку/}).check();
  await page.getByRole("button",{name:"Отправить заявку",exact:true}).scrollIntoViewIfNeeded();
  const scroll=await page.evaluate(()=>window.scrollY);
  await page.getByRole("button",{name:"Отправить заявку",exact:true}).click();
  await expect(page.getByText(/Заявка synthetic-request/)).toBeVisible();
  await expect(page.getByRole('button',{name:'Заявка отправлена: Вымышленный дом 1',exact:true})).toBeDisabled();
  await expect(page.getByRole("link",{name:"Позвонить",exact:true}).last()).toBeVisible();
  expect(Math.abs(await page.evaluate(()=>window.scrollY)-scroll)).toBeLessThan(200);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
  await page.screenshot({path:testInfo.outputPath("journey-house.png"),fullPage:true});
  await page.getByRole("link",{name:"Вернуться к результатам",exact:true}).click();
  await expect(page.getByText("Найдено домов: 2",{exact:true})).toBeVisible();
  await expect(page.locator('[data-domkazan-transition]')).toHaveCount(0);
  expect(Math.abs(await page.evaluate(()=>scrollY)-catalogY)).toBeLessThan(3);
  await expect(page.getByLabel("Сортировать",{exact:true})).toHaveValue("price-desc");
  await expect(page.getByRole("checkbox",{name:"Бассейн",exact:true})).toBeChecked();
  await expect(page.getByRole("checkbox",{name:"Баня / сауна",exact:true})).toBeChecked();
  await expect(page.getByLabel('Гостей',{exact:true})).toHaveValue('8');
  const returned=new URL(page.url());expect(returned.searchParams.get('checkIn')).toBe(day(2));expect(returned.searchParams.get('checkOut')).toBe(day(4));
  expect(errors).toEqual([]);
});
