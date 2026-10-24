import test, { after } from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {NextRequest} from "next/server";
import {db} from "../src/lib/db.ts";
import {CLIENT_UI_DEFAULTS} from "../src/lib/client-ui.ts";
import {GET as readPublic} from "../src/app/api/client-settings/route.ts";
import {GET as readAdmin,PUT as saveAdmin} from "../src/app/api/admin/settings/route.ts";
import {GET as availability} from "../src/app/api/availability/route.ts";
import {createAdminSession,revokeAdminSession,SESSION_COOKIE} from "../src/lib/auth.ts";
import {dateKey,todayInMoscow} from "../src/lib/dates.ts";

process.env.SESSION_SECRET="synthetic-client-settings-secret-more-than-32-characters";
process.env.ADMIN_EMAIL="settings@example.invalid";
process.env.ADMIN_PASSWORD_HASH=`scrypt:test:${'0'.repeat(128)}`;
process.env.TILDA_ORIGIN='https://domkazan116.ru';
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
    assert.deepEqual(await defaults.json(),CLIENT_UI_DEFAULTS);
    const settings=structuredClone(CLIENT_UI_DEFAULTS);settings.texts.videoButton='Видео дома';settings.colors.primary='#164C9A';
    const results=await Promise.all([saveAdmin(req('PUT',{revision:0,settings},token)),saveAdmin(req('PUT',{revision:0,settings},token))]);
    assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
    const publicResponse=await readPublic(new NextRequest('http://localhost:3000/api/client-settings',{headers:{origin:process.env.TILDA_ORIGIN!}}));
    assert.equal(publicResponse.headers.get('access-control-allow-origin'),process.env.TILDA_ORIGIN);
    assert.deepEqual(await publicResponse.json(),settings);
    const admin=await(await readAdmin(req('GET',undefined,token))).json();assert.equal(admin.revision,1);
    assert.equal((await saveAdmin(req('PUT',{revision:1,settings:{...settings,texts:{...settings.texts,videoButton:'<script>alert(1)</script>'}}},token))).status,400);
    assert.equal((await saveAdmin(req('PUT',{revision:1,settings:{...settings,colors:{...settings.colors,primary:'#FFFFFF'}}},token))).status,400);
    assert.equal((await saveAdmin(req('PUT',{revision:1,settings},token))).status,200);
    assert.equal((await saveAdmin(req('PUT',{revision:1,settings},token))).status,409);
  }finally{await revokeAdminSession(token);await db.clientUiSettings.deleteMany();}
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
