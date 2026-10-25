import test, { after } from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {NextRequest} from "next/server";
import {db} from "../src/lib/db.ts";
import {CLIENT_UI_DEFAULTS} from "../src/lib/client-ui.ts";
import {GET as readPublic} from "../src/app/api/client-settings/route.ts";
import {GET as readAdmin,PUT as saveAdmin} from "../src/app/api/admin/settings/route.ts";
import {GET as availability} from "../src/app/api/availability/route.ts";
import {GET as publicCatalogRoute} from '../src/app/api/catalog/route.ts';
import {createAdminSession,revokeAdminSession,SESSION_COOKIE} from "../src/lib/auth.ts";
import {dateKey,todayInMoscow} from "../src/lib/dates.ts";

process.env.SESSION_SECRET="synthetic-client-settings-secret-more-than-32-characters";
process.env.ADMIN_EMAIL="settings@example.invalid";
process.env.ADMIN_PASSWORD_HASH=`scrypt:test:${'0'.repeat(128)}`;
process.env.TILDA_ORIGIN='https://domkazan116.ru';
process.env.PUBLIC_OWNER_PHONE='';process.env.PUBLIC_OWNER_TELEGRAM='';process.env.PUBLIC_OWNER_WHATSAPP='';
after(async()=>{await db.$disconnect();});
const req=(method:string,payload?:unknown,token?:string,origin='http://localhost:3000')=>new NextRequest('http://localhost:3000/api/admin/settings',{method,headers:{origin,'content-type':'application/json',...(token?{cookie:`${SESSION_COOKIE}=${token}`}:{})},...(payload?{body:JSON.stringify(payload)}:{})});

test('settings migration, admin access, public read, validation and concurrent saves',async()=>{
  await db.clientUiSettings.deleteMany();
  const token=await createAdminSession(process.env.ADMIN_EMAIL!);
  try {
    assert.equal((await readAdmin(req('GET'))).status,401);
    assert.equal((await saveAdmin(req('PUT',{revision:0,settings:CLIENT_UI_DEFAULTS}))).status,401);
    assert.equal((await saveAdmin(req('PUT',{revision:0,settings:CLIENT_UI_DEFAULTS},token,'https://evil.invalid'))).status,403);
    const defaults=await readPublic(new NextRequest('http://localhost:3000/api/client-settings'));
    assert.deepEqual(await defaults.json(),{...CLIENT_UI_DEFAULTS,contacts:{phone:null,telegram:null,whatsapp:null},testEnvironment:process.env.TEST_CATALOG_ENABLED==='true'||process.env.VERCEL_ENV==='preview'});
    const settings=structuredClone(CLIENT_UI_DEFAULTS);settings.texts.videoButton='Видео дома';settings.colors.primary='#164C9A';
    const results=await Promise.all([saveAdmin(req('PUT',{revision:0,settings},token)),saveAdmin(req('PUT',{revision:0,settings},token))]);
    assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
    const publicResponse=await readPublic(new NextRequest('http://localhost:3000/api/client-settings',{headers:{origin:process.env.TILDA_ORIGIN!}}));
    assert.equal(publicResponse.headers.get('access-control-allow-origin'),process.env.TILDA_ORIGIN);
    assert.deepEqual(await publicResponse.json(),{...settings,contacts:{phone:null,telegram:null,whatsapp:null},testEnvironment:process.env.TEST_CATALOG_ENABLED==='true'||process.env.VERCEL_ENV==='preview'});
    const admin=await(await readAdmin(req('GET',undefined,token))).json();assert.equal(admin.revision,1);
    assert.equal((await saveAdmin(req('PUT',{revision:1,settings:{...settings,texts:{...settings.texts,videoButton:'<script>alert(1)</script>'}}},token))).status,400);
    assert.equal((await saveAdmin(req('PUT',{revision:1,settings:{...settings,colors:{...settings.colors,primary:'#FFFFFF'}}},token))).status,400);
    assert.equal((await saveAdmin(req('PUT',{revision:1,settings},token))).status,200);
    assert.equal((await saveAdmin(req('PUT',{revision:1,settings},token))).status,409);
  }finally{await revokeAdminSession(token);await db.clientUiSettings.deleteMany();}
});

test('public environment marker is server controlled and never disables a test Preview',async()=>{
  const previous={test:process.env.TEST_CATALOG_ENABLED,vercel:process.env.VERCEL_ENV};
  try{
    for(const [testFlag,vercel,expected] of [['true','production',true],['false','preview',true],['false','production',false]] as const){
      process.env.TEST_CATALOG_ENABLED=testFlag;process.env.VERCEL_ENV=vercel;
      const response=await readPublic(new NextRequest('http://localhost:3000/api/client-settings?testEnvironment=false'));
      assert.equal((await response.json()).testEnvironment,expected);
    }
  }finally{
    if(previous.test===undefined)delete process.env.TEST_CATALOG_ENABLED;else process.env.TEST_CATALOG_ENABLED=previous.test;
    if(previous.vercel===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=previous.vercel;
  }
});

test('specific house availability distinguishes capacity, occupation, missing price and minimum nights',async()=>{
  const day=(offset:number)=>new Date(todayInMoscow().getTime()+offset*86400000);
  const house=await db.house.create({data:{slug:`ui-test-${randomUUID()}`,name:'Synthetic UX House',maxGuests:4}});
  const url=(guests=2)=>new NextRequest(`http://localhost:3000/api/availability?house=${house.slug}&checkIn=${dateKey(day(8))}&checkOut=${dateKey(day(10))}&guests=${guests}`);
  const reason=async(guests=2)=>{const r=await availability(url(guests));assert.equal(r.status,200);const data=await r.json();assert.deepEqual(data.houses,[]);assert.doesNotMatch(JSON.stringify(data),/clientPhone|bookingRequestId|Synthetic UX House/);return data.unavailability;};
  try {
    assert.deepEqual(await reason(5),{code:'CAPACITY',maxGuests:4});
    assert.deepEqual(await reason(),{code:'UNPRICED'});
    const rate=await db.baseRate.create({data:{houseId:house.id,startsOn:day(0),endsOn:day(40),weekdayPrice:'1000',fridayPrice:'2000',saturdayPrice:'3000',sundayPrice:'1500',minNights:3}});
    assert.deepEqual(await reason(),{code:'MIN_NIGHTS',minNights:3});
    await db.baseRate.update({where:{id:rate.id},data:{minNights:1}});
    const response=await(await availability(url())).json();assert.equal(response.houses.length,1);assert.equal(response.unavailability,undefined);
    await db.blockedPeriod.create({data:{houseId:house.id,startsOn:day(9),endsOn:day(10),reason:'private synthetic note'}});
    assert.deepEqual(await reason(),{code:'OCCUPIED'});
    assert.deepEqual(await reason(6),{code:'CAPACITY',maxGuests:4});
    await db.blockedPeriod.deleteMany({where:{houseId:house.id}});
    await db.bookingRequest.create({data:{houseId:house.id,checkIn:day(9),checkOut:day(11),guestCount:2,clientName:'Synthetic Guest',status:'CONFIRMED'}});
    assert.deepEqual(await reason(),{code:'OCCUPIED'});
  }finally{await db.bookingRequest.deleteMany({where:{houseId:house.id}});await db.house.delete({where:{id:house.id}});}
});

test('publishing Tilda text and media preserves UID mapping, calendar prices and blocked periods',async()=>{
  const day=(offset:number)=>new Date(todayInMoscow().getTime()+offset*86400000);
  const uid='888888888888';const house=await db.house.create({data:{slug:`content-${randomUUID()}`,tildaProductUid:uid,name:'Synthetic content house',maxGuests:4,
    baseRates:{create:{startsOn:day(0),endsOn:day(30),weekdayPrice:'1000',fridayPrice:'1000',saturdayPrice:'1000',sundayPrice:'1000'}},
    dateOverrides:{create:{date:day(8),pricePerNight:'1700'}},blockedPeriods:{create:{startsOn:day(12),endsOn:day(14),reason:'Synthetic closure'}}}});
  const previous=globalThis.fetch;let published='Первый абзац';
  globalThis.fetch=async()=>Response.json({total:1,products:[{uid,title:'Synthetic Tilda house',descr:'Кратко',text:`<p>${published}</p>`,gallery:JSON.stringify([{img:'https://static.tildacdn.com/synthetic.jpg',video:'https://rutube.ru/video/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/'}])}]});
  const url=new NextRequest(`http://localhost:3000/api/availability?house=tilda-${uid}&checkIn=${dateKey(day(8))}&checkOut=${dateKey(day(10))}&guests=2`);
  try{
    const before=await(await availability(url)).json();assert.equal(before.houses[0].quote.total,'2700.00');
    assert.equal((await(await publicCatalogRoute(new NextRequest('http://localhost:3000/api/catalog'))).json()).products[0].description,published);
    published='Новый текст владельца. Доплата 500 ₽';
    const next=await(await publicCatalogRoute(new NextRequest('http://localhost:3000/api/catalog'))).json();assert.equal(next.products[0].description,published);assert.equal(next.products[0].productUid,uid);assert.ok(next.products[0].rutubeUrl);
    assert.deepEqual(await(await availability(url)).json(),before);
    assert.equal(await db.blockedPeriod.count({where:{houseId:house.id}}),1);assert.equal(await db.dateOverride.count({where:{houseId:house.id}}),1);
  }finally{globalThis.fetch=previous;await db.house.delete({where:{id:house.id}});}
});
