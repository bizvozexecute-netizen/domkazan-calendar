import test, { after } from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {NextRequest} from "next/server";
import {db} from "../src/lib/db.ts";
import {dateKey,todayInMoscow} from "../src/lib/dates.ts";
import {GET as calendar} from "../src/app/api/houses/[slug]/calendar/route.ts";
import {createHouse,updateHouse} from "../src/lib/admin-mutations.ts";

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
