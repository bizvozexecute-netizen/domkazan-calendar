import {test,expect,type Page} from '@playwright/test';
import {db} from '../../src/lib/db';

const month='2027-01';
const dates=Array.from({length:31},(_,i)=>`${month}-${String(i+1).padStart(2,'0')}`);
const houses=Array.from({length:80},(_,i)=>({id:`density-${i}`,slug:`density-${i}`,name:`Вымышленный длинный дом для проверки ${i}`,calendarName:`Дом ${i}`,isActive:true,revision:0,
  cells:dates.map(date=>({date,price:'12000.00',source:'base',status:i===2?'closed':'free'}))}));
async function login(page:Page){
  await page.goto('/admin/login');await page.getByLabel('Email',{exact:true}).fill('browser-tester@example.invalid');
  await page.getByLabel('Пароль',{exact:true}).fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole('button',{name:'Войти',exact:true}).click();await expect(page).toHaveURL(/\/admin$/);
}
test.afterAll(async()=>{await db.$disconnect();});

test('dense board fits dates, preserves mode, sticky axes and full house names without scroll rerenders',async({page,browserName},testInfo)=>{
  await page.route('**/api/admin/calendar?*',route=>route.fulfill({json:{month,dates,houses}}));
  await login(page);await page.goto(`/admin?month=${month}`);
  const region=page.getByRole('region',{name:'Цены и занятость домов',exact:true});
  await expect(region.locator('tbody tr')).toHaveCount(80);
  const geometry=await region.evaluate(el=>{
    const house=el.querySelector('thead th')!.getBoundingClientRect().width;
    const date=el.querySelector('[data-calendar-date]')!.getBoundingClientRect().width;
    return {visible:Math.floor((el.clientWidth-house)/date),width:el.clientWidth,date,house};
  });
  if((page.viewportSize()?.width??0)<=430)expect(geometry.visible).toBeGreaterThanOrEqual(8);
  if((page.viewportSize()?.width??0)>=1280)expect(geometry.visible).toBe(31);
  for(const date of dates){
    const weekday=new Date(date+'T00:00:00Z').getUTCDay();
    expect(await page.locator(`[data-calendar-date="${date}"]`).getAttribute('data-weekend')).toBe(weekday===5||weekday===6?'':null);
  }
  await page.getByRole('button',{name:`Полное название: ${houses[0].name}`,exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText(houses[0].name);
  await page.getByRole('button',{name:'Закрыть название',exact:true}).click();
  await page.getByRole('button',{name:'Обычный',exact:true}).click();await page.reload();
  await expect(page.getByRole('button',{name:'Обычный',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'Компактный',exact:true}).click();
  await expect(region.locator('tbody tr')).toHaveCount(80);
  await region.scrollIntoViewIfNeeded();
  const metrics=await region.evaluate(async el=>{
    el.scrollLeft=80;el.scrollTop=150;
    await new Promise(requestAnimationFrame);
    let mutations=0;const observer=new MutationObserver(records=>{mutations+=records.length;});
    observer.observe(el,{subtree:true,attributes:true,childList:true,characterData:true});
    const frames:number[]=[];
    let previous=performance.now();
    for(let i=0;i<20;i++){await new Promise(requestAnimationFrame);const now=performance.now();frames.push(now-previous);previous=now;el.scrollTop+=5;}
    observer.disconnect();
    const box=el.getBoundingClientRect(),header=el.querySelector('thead th:nth-child(2)')!.getBoundingClientRect(),house=el.querySelector('tbody th')!.getBoundingClientRect();
    return {mutations,frames,headerTop:header.top-box.top,houseLeft:house.left-box.left};
  });
  expect(metrics.mutations).toBe(0);expect(Math.abs(metrics.headerTop)).toBeLessThan(2);expect(Math.abs(metrics.houseLeft)).toBeLessThan(2);
  let nativeGesture;
  if(browserName==='chromium' && (page.viewportSize()?.width??0)<=430){
    const cdp=await page.context().newCDPSession(page);
    const box=(await region.boundingBox())!;
    const start=await region.evaluate(el=>({left:el.scrollLeft,top:el.scrollTop}));
    await cdp.send('Input.synthesizeScrollGesture',{x:Math.round(box.x+box.width-45),y:Math.round(Math.min(box.y+box.height-60,700)),yDistance:-110,xDistance:-12,gestureSourceType:'touch',speed:400});
    const afterVertical=await region.evaluate(el=>({left:el.scrollLeft,top:el.scrollTop}));
    expect(afterVertical.top-start.top).toBeGreaterThan(40);expect(Math.abs(afterVertical.left-start.left)).toBeLessThanOrEqual(3);
    await cdp.send('Input.synthesizeScrollGesture',{x:Math.round(box.x+box.width-45),y:Math.round(Math.min(box.y+box.height-60,700)),yDistance:-10,xDistance:-110,gestureSourceType:'touch',speed:400});
    const afterHorizontal=await region.evaluate(el=>({left:el.scrollLeft,top:el.scrollTop}));
    expect(afterHorizontal.left-afterVertical.left).toBeGreaterThan(40);expect(Math.abs(afterHorizontal.top-afterVertical.top)).toBeLessThanOrEqual(3);
    nativeGesture={start,afterVertical,afterHorizontal};await cdp.detach();
  }
  // Native event delivery is engine-dependent in emulation. This exercises the
  // passive fallback and momentum without pretending synthetic events are fingers.
  const drift=await region.evaluate(el=>{
    const fire=(type:string,x:number,y:number)=>el.dispatchEvent(new TouchEvent(type,{touches:type==='touchend'?[]:[new Touch({identifier:1,target:el,clientX:x,clientY:y})],bubbles:true}));
    const left=el.scrollLeft,top=el.scrollTop;
    fire('touchstart',100,150);fire('touchmove',94,90);el.scrollLeft+=18;el.scrollTop+=70;el.dispatchEvent(new Event('scroll'));
    const vertical={secondary:el.scrollLeft-left,primary:el.scrollTop-top};fire('touchend',0,0);
    fire('touchstart',100,150);fire('touchmove',40,146);const second=el.scrollTop;el.scrollLeft+=60;el.scrollTop+=16;el.dispatchEvent(new Event('scroll'));
    const horizontal={secondary:el.scrollTop-second};fire('touchend',0,0);el.dispatchEvent(new Event('scrollend'));
    return {vertical,horizontal};
  });
  expect(drift.vertical.secondary).toBe(0);expect(drift.vertical.primary).toBe(70);expect(drift.horizontal.secondary).toBe(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  const clipping=await region.locator('td button').evaluateAll(buttons=>buttons.some(el=>el.scrollWidth>el.clientWidth+1));expect(clipping).toBe(false);
  await testInfo.attach('board-measurements',{body:JSON.stringify({geometry,metrics,drift,nativeGesture}),contentType:'application/json'});
  await page.screenshot({path:testInfo.outputPath('compact-calendar.png'),fullPage:true});
});

test('range close, reopen and manual price retain board position and change public search',async({page,request},testInfo)=>{
  const id=`compact-action-${testInfo.project.name}`;
  await db.house.deleteMany({where:{id}});
  await db.house.create({data:{id,slug:id,name:'Вымышленный UX дом',maxGuests:4,baseRates:{create:{startsOn:new Date('2027-01-01'),endsOn:new Date('2027-02-01'),weekdayPrice:12000,fridayPrice:13000,saturdayPrice:14000,sundayPrice:12000}}}});
  try{
    await login(page);await page.goto(`/admin?month=${month}`);
    const region=page.getByRole('region',{name:'Цены и занятость домов',exact:true});
    const row=region.locator('tr').filter({has:page.getByRole('button',{name:'Полное название: Вымышленный UX дом',exact:true})});
    await expect(row).toBeVisible();
    await region.scrollIntoViewIfNeeded();
    await row.getByRole('button',{name:/2027-01-10, Свободно/}).click();
    await row.getByRole('button',{name:/2027-01-12, Свободно/}).click();
    await expect(row.locator('[aria-pressed=true]')).toHaveCount(3);
    const position=()=>region.evaluate(el=>({left:el.scrollLeft,top:el.scrollTop}));
    const search=async()=> (await(await request.get(`/api/availability?checkIn=2027-01-10&checkOut=2027-01-13&guests=2`)).json()).houses.find((h:{slug:string})=>h.slug===id);
    const confirm=async(label:string)=>{
      await page.getByRole('button',{name:label,exact:true}).click();
      const before=await position();
      await page.getByRole('button',{name:'Подтвердить изменение',exact:true}).click();
      await expect(page.getByRole('status').filter({hasText:'Изменения сохранены.'})).toBeVisible();
      expect(await position()).toEqual(before);
    };
    await confirm('Закрыть даты');expect(await search()).toBeUndefined();
    await confirm('Открыть даты');expect(await search()).toBeTruthy();
    await page.getByLabel('Ручная цена, ₽',{exact:true}).fill('12345.67');
    await confirm('Изменить стоимость');expect((await search()).quote.total).toBe('37037.01');
    await page.getByRole('button',{name:'Закрыть панель действий',exact:true}).click();
    await expect(row.locator('.calendar-price').filter({hasText:'12345,67'})).toHaveCount(3);
    expect(await row.locator('.calendar-price').evaluateAll(buttons=>buttons.some(el=>el.scrollWidth>el.clientWidth+1))).toBe(false);
  }finally{await db.house.delete({where:{id}});}
});
