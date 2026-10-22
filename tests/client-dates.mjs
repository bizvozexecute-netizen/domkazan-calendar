const base=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Moscow'}).format(new Date());
export const clientDay=offset=>new Date(Date.parse(`${base}T00:00:00Z`)+offset*86400000).toISOString().slice(0,10);
export const clientStayQuery=`checkIn=${clientDay(2)}&checkOut=${clientDay(4)}&guests=2`;
