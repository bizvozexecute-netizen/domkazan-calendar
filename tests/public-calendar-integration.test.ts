import test, { after } from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {NextRequest} from "next/server";
import {db} from "../src/lib/db.ts";
import {dateKey,todayInMoscow} from "../src/lib/dates.ts";
import {GET as calendar} from "../src/app/api/houses/[slug]/calendar/route.ts";
import {GET as previewCalendar} from "../src/app/api/house-calendar/route.ts";
import {createHouse,updateHouse,saveRate} from "../src/lib/admin-mutations.ts";
import {GET as availability} from "../src/app/api/availability/route.ts";

after(async()=>{await db.$disconnect();});
test("public calendar distinguishes occupancy and absent tariffs without revealing customer records",async()=>{
  const slug=`calendar-${randomUUID()}`;
  const start=todayInMoscow();
  const day=(offset:number)=>new Date(start.getTime()+offset*86400000);
  const house=await db.house.create({data:{slug,name:"Synthetic calendar",maxGuests:8,
    baseRates:{create:{startsOn:start,endsOn:day(4),weekdayPrice:"1000",fridayPrice:"2000",saturdayPrice:"3000",sundayPrice:"1500"}},
    dateOverrides:{create:{date:day(1),pricePerNight:"7777"}},
    blockedPeriods:{create:{startsOn:day(2),endsOn:day(3),reason:"private synthetic reason"}},
    bookingRequests:{create:{checkIn:day(3),checkOut:day(4),guestCount:2,clientName:"Private Synthetic",clientPhone:"+70000000000",status:"CONFIRMED"}},
  }});
  process.env.TILDA_ORIGIN="https://domkazan116.ru";
  try{
    const response=await calendar(new NextRequest(`http://localhost/api/houses/${slug}/calendar?month=${dateKey(start).slice(0,7)}`,{headers:{origin:process.env.TILDA_ORIGIN}}),{params:Promise.resolve({slug})});
    assert.equal(response.status,200);assert.equal(response.headers.get("cache-control"),"no-store");
    assert.equal(response.headers.get("access-control-allow-origin"),process.env.TILDA_ORIGIN);
    const result=await response.json();
    const find=(offset:number)=>result.days.find((item:{date:string})=>item.date===dateKey(day(offset)));
    assert.equal(find(1).price,"7777");assert.equal(find(2).status,"occupied");assert.equal(find(3).status,"occupied");assert.equal(find(4).status,"unpriced");
    assert.doesNotMatch(JSON.stringify(result),/Private Synthetic|private synthetic|clientPhone|bookingRequests|\+70000000000/);
    const preview=await previewCalendar(new NextRequest(`http://localhost/api/house-calendar?house=${slug}&month=${dateKey(start).slice(0,7)}`));
    assert.equal(preview.status,200);assert.deepEqual(await preview.json(),result);
    assert.equal((await previewCalendar(new NextRequest(`http://localhost/api/house-calendar?month=${dateKey(start).slice(0,7)}`))).status,400);
    await db.house.update({where:{id:house.id},data:{isActive:false}});
    const unavailable=await calendar(new NextRequest(`http://localhost/api/houses/${slug}/calendar?month=${dateKey(start).slice(0,7)}`),{params:Promise.resolve({slug})});
    assert.equal(unavailable.status,404);
  }finally{await db.bookingRequest.deleteMany({where:{houseId:house.id}});await db.house.delete({where:{id:house.id}});}
});
test("house short name and Product UID survive edits; duplicate UID is rejected",async()=>{
  const uid=String(Date.now());const slug=`identity-${randomUUID()}`;
  const fields={name:"Full synthetic name",slug,tildaProductUid:uid,calendarName:"НС В1",maxGuests:8,tildaUrl:null,district:null,bedrooms:null,bathrooms:null,amenities:[],petsAllowed:null,isActive:false};
  const house=await createHouse(fields);
  try{
    const changed=await updateHouse(house.id,house.revision,{...fields,name:"Updated full name"});
    assert.equal(changed.calendarName,"НС В1");assert.equal(changed.tildaProductUid,uid);
    await assert.rejects(createHouse({...fields,slug:`other-${randomUUID()}`}));
  }finally{await db.house.delete({where:{id:house.id}});}
});

test("Tilda UID keeps search and calendar mapped after slug edits and cannot fall back to an unrelated slug",async()=>{
  const uid=String(Date.now()).slice(-12),alias=`tilda-${uid}`,slug=`mapped-${randomUUID()}`;
  const fields={name:"Synthetic UID house",slug,tildaProductUid:uid,calendarName:null,maxGuests:8,tildaUrl:null,district:null,bedrooms:null,bathrooms:null,amenities:[],petsAllowed:null,isActive:true};
  const house=await createHouse(fields);
  const shadow=await createHouse({...fields,slug:alias,tildaProductUid:null});
  const start=todayInMoscow(),key=(n:number)=>dateKey(new Date(start.getTime()+n*86400000));
  const rates={startsOn:key(0),endsOn:key(40),weekdayPrice:"1000",fridayPrice:"1000",saturdayPrice:"1000",sundayPrice:"1000",minNights:1};
  const search=()=>availability(new NextRequest(`http://localhost/api/availability?house=${alias}&checkIn=${key(1)}&checkOut=${key(3)}&guests=2`));
  const readCalendar=()=>calendar(new NextRequest(`http://localhost/api/houses/${alias}/calendar?month=${key(0).slice(0,7)}`),{params:Promise.resolve({slug:alias})});
  try{
    const tariff=await saveRate(house.id,0,rates);await saveRate(shadow.id,0,rates);
    const renamed=await updateHouse(house.id,tariff.revision,{...fields,slug:`renamed-${randomUUID()}`});
    const response=await search();assert.equal(response.status,200);
    const result=await response.json();assert.equal(result.houses.length,1);
    assert.equal(result.houses[0].id,house.id);assert.equal(result.houses[0].slug,renamed.slug);assert.equal(result.houses[0].tildaProductUid,uid);
    assert.equal(Number(result.houses[0].quote.total),2000);
    const calendarResponse=await readCalendar();assert.equal(calendarResponse.status,200);assert.equal((await calendarResponse.json()).house.id,house.id);
    await updateHouse(house.id,renamed.revision,{...fields,slug:renamed.slug,tildaProductUid:null});
    assert.deepEqual((await (await search()).json()).houses,[]);assert.equal((await readCalendar()).status,404);
  }finally{await db.house.deleteMany({where:{id:{in:[house.id,shadow.id]}}});}
});

test("repeated Tilda test seed preserves a renamed, unlinked imported house and its calendar",async(context)=>{
  assert.ok(new URL(process.env.DATABASE_URL!).pathname.endsWith('_test'));
  const snapshot=JSON.parse(readFileSync(new URL('../data/tilda-catalog-public.json',import.meta.url),'utf8')) as {products:{productUid:string}[]};
  const ids=snapshot.products.map(product=>`tilda-${product.productUid}`),uids=snapshot.products.map(product=>product.productUid);
  if(await db.house.count({where:{OR:[{id:{in:ids}},{slug:{in:ids}},{tildaProductUid:{in:uids}}]}})){
    context.skip('Existing imported test houses must not be modified by this isolated fixture.');return;
  }
  await db.house.createMany({data:snapshot.products.map(product=>({id:`tilda-${product.productUid}`,slug:`tilda-${product.productUid}`,tildaProductUid:product.productUid,name:'Synthetic seed placeholder',maxGuests:2,isActive:false,revision:1}))});
  try{
    const id=ids[0],slug=`edited-import-${randomUUID()}`,start=todayInMoscow(),end=new Date(start.getTime()+86400000);
    await db.house.update({where:{id},data:{slug,tildaProductUid:null,name:'Synthetic edited import',calendarName:'Edited',revision:2}});
    await db.baseRate.create({data:{houseId:id,startsOn:start,endsOn:end,weekdayPrice:'1234',fridayPrice:'1234',saturdayPrice:'1234',sundayPrice:'1234'}});
    await db.dateOverride.create({data:{houseId:id,date:start,pricePerNight:'5678'}});
    await db.blockedPeriod.create({data:{houseId:id,startsOn:start,endsOn:end,reason:'Synthetic seed fixture'}});
    const read=()=>db.house.findUniqueOrThrow({where:{id},include:{baseRates:true,dateOverrides:true,blockedPeriods:true}});
    const before=await read();
    for(let run=0;run<2;run++){
      const result=spawnSync(process.execPath,['--import','tsx','scripts/seed-tilda-catalog-test.ts'],{env:{...process.env,ALLOW_TEST_SEED:'true'},encoding:'utf8',timeout:30000});
      assert.equal(result.status,0,result.stderr);
      assert.equal(await db.house.count({where:{id:{in:ids}}}),ids.length);
      assert.deepEqual(await read(),before);
    }
  }finally{await db.house.deleteMany({where:{id:{in:ids}}});}
});
