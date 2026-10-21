import {test,expect} from '@playwright/test';
import {selectStay} from '../e2e/stay-helper';
const path='/calendar-test-311744409';
const day=(offset:number)=>new Date(Date.now()+offset*86400000).toISOString().slice(0,10);

test('published TEST Tilda: search, detail, actual photo, safe request and return',async({page},testInfo)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  let documents=0;page.on('request',request=>{if(request.isNavigationRequest()&&request.frame()===page.mainFrame()&&new URL(request.url()).pathname===path)documents++;});
  await page.goto(path);await expect(page.locator('.cards article').first()).toBeVisible();
  const timeOrigin=await page.evaluate(()=>{
    const state={flashes:0};Object.assign(window,{domkazanHeroCheck:state});
    const check=()=>{const records=document.querySelector('#allrecords');if(records?.classList.contains('dkcal-ready')){for(const node of records.children){if(node.id!=='rec4862390501'&&node.classList.contains('r')&&node.getBoundingClientRect().height>0&&getComputedStyle(node).display!=='none'){state.flashes++;break;}}}else state.flashes++;requestAnimationFrame(check);};
    requestAnimationFrame(check);return performance.timeOrigin;
  });
  await selectStay(page,day(2),day(4));await page.getByLabel('Гостей',{exact:true}).fill('8');
  await page.getByRole('checkbox',{name:'Бассейн',exact:true}).check();await page.getByRole('checkbox',{name:'Баня / сауна',exact:true}).check();
  await page.getByRole('button',{name:'Показать свободные дома',exact:true}).click();
  await expect(page.locator('.count')).toHaveText(/Найдено домов: [1-9]\d*/,{timeout:20000});
  await page.getByLabel('Сортировать',{exact:true}).selectOption('price');
  const cards=page.locator('.cards article:visible');
  const totals=await cards.locator('.price').allTextContents();
  const prices=totals.map(value=>Number(value.split('₽')[0].replace(/[^\d,]/g,'').replace(',','.')));
  expect(prices).toEqual([...prices].sort((a,b)=>a-b));
  await page.screenshot({path:testInfo.outputPath('real-catalog.png')});
  const card=cards.first();const uid=(await card.getAttribute('data-domkazan-house'))!.replace('tilda-','');
  await card.getByRole('link',{name:/Подробнее:/}).scrollIntoViewIfNeeded();const catalogY=await page.evaluate(()=>scrollY);
  await card.getByRole('link',{name:/Подробнее:/}).click();await expect(page).toHaveURL(new RegExp(`house=${uid}`));
  expect(await page.evaluate(()=>performance.timeOrigin)).toBe(timeOrigin);
  await expect(page.getByText('Дом свободен. Стоимость рассчитана сервером.',{exact:true})).toBeVisible({timeout:20000});
  const photo=page.locator('.gallery .photo-button img');await expect(photo).toHaveClass('loaded',{timeout:30000});
  expect(await photo.evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBeGreaterThan(0);
  await page.getByRole('button',{name:'Следующее фото',exact:true}).click();await expect(photo).toHaveClass('loaded',{timeout:30000});
  await page.getByRole('button',{name:'Увеличить фото',exact:true}).click();await expect(page.getByRole('dialog',{name:'Увеличенное фото',exact:true})).toBeVisible();
  await page.keyboard.press('ArrowRight');await page.keyboard.press('Escape');
  await expect(page.getByRole('button',{name:'Увеличить фото',exact:true})).toBeFocused();
  await page.screenshot({path:testInfo.outputPath('real-house.png'),fullPage:true});
  await page.getByRole('button',{name:/Оставить заявку:/}).click();await expect(page.getByLabel('Имя',{exact:true})).toBeInViewport();
  await expect(page.getByLabel('Имя',{exact:true})).toHaveValue('Тестовый Гость');await expect(page.getByLabel('Телефон',{exact:true})).toHaveValue('+70000000000');
  await expect(page.getByRole('link',{name:'Политика обработки данных',exact:true})).toHaveAttribute('href',/\/test-policy$/);
  if(process.env.LIVE_TILDA_ALLOW_SYNTHETIC_REQUEST==='true'&&testInfo.project.name==='live-desktop'){
    await page.getByRole('checkbox',{name:/Согласен на обработку/}).check();
    const result=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/requests'&&r.request().method()==='POST');
    await page.getByRole('button',{name:'Отправить заявку',exact:true}).click();const response=await result;
    expect(response.status()).toBe(201);const data=await response.json();
    expect(JSON.stringify(data)).not.toMatch(/Тестовый Гость|\+70000000000/);
    await expect(page.getByText(new RegExp(`Заявка ${data.requestId}:`))).toBeVisible();
    await page.screenshot({path:testInfo.outputPath('real-receipt.png'),fullPage:true});
    // A NEW request never closes dates: repeat the real availability check.
    const available=await page.request.get(`https://domkazan-calendar-tilda-test-gatewa.vercel.app/api/availability?checkIn=${day(2)}&checkOut=${day(4)}&guests=8&house=tilda-${uid}`,{headers:{Origin:'https://domkazan116.ru'}});
    expect((await available.json()).houses.some((h:{slug:string})=>h.slug===`tilda-${uid}`)).toBe(true);
    await page.getByRole('link',{name:'Вернуться к результатам',exact:true}).click();
  }else{
    await page.getByLabel('Гостей',{exact:true}).fill('9');await expect(page.getByRole('form',{name:'Заявка на проживание'})).toBeHidden();
    await expect(page.locator('[data-domkazan-action-for]')).toHaveCount(0);
    await page.getByRole('link',{name:'← К результатам поиска',exact:true}).click();
  }
  await expect(page.locator('.count')).toHaveText(/Найдено домов: [1-9]\d*/,{timeout:20000});
  await expect(page.getByLabel('Сортировать',{exact:true})).toHaveValue('price');await expect(page.getByRole('checkbox',{name:'Бассейн',exact:true})).toBeChecked();
  await expect(page.locator('[data-domkazan-transition]')).toHaveCount(0);expect(Math.abs(await page.evaluate(()=>scrollY)-catalogY)).toBeLessThan(3);
  expect(documents).toBe(1);expect(await page.evaluate(()=>performance.timeOrigin)).toBe(timeOrigin);
  expect(await page.evaluate(()=>(window as Window&{domkazanHeroCheck?:{flashes:number}}).domkazanHeroCheck?.flashes)).toBe(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);expect(errors).toEqual([]);
});
