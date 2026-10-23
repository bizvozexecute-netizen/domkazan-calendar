import {test as base,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
export {expect};

// Opt-in verification of unshipped code inside the existing test document.
// The interception affects this browser only; it never writes or publishes Tilda.
export const test=base.extend<{localTestCode:void}>({localTestCode:[async({context},use)=>{
  if(process.env.LIVE_TILDA_LOCAL_WIDGET==='true'||process.env.LIVE_TILDA_LOCAL_BOOTSTRAP==='true'){
    for(const name of ['domkazan-search.js','domkazan-catalog.js']){
      await context.route(`https://domkazan-calendar-tilda-test-gatewa.vercel.app/embed/${name}*`,async route=>route.fulfill({contentType:'application/javascript',body:await readFile(`public/embed/${name}`,'utf8')}));
    }
  }
  if(process.env.LIVE_TILDA_LOCAL_BOOTSTRAP==='true'){
    await context.route(/^https:\/\/domkazan116\.ru\/calendar-test-311744409(?:\?|$)/,async route=>{
      const response=await route.fetch();const html=await response.text();
      const start=html.indexOf('<!-- DomKazan: page-local catalog');
      const end=html.indexOf('<!-- nominify end -->',start);
      if(start<0||end<start)throw new Error('Test T123 boundary changed; refusing replacement');
      await route.fulfill({response,body:html.slice(0,start)+await readFile('integration/tilda-311744409-t123.html','utf8')+html.slice(end)});
    });
  }
  await use();
},{auto:true}]});

