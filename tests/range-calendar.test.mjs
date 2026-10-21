import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const script=readFileSync(new URL('../public/embed/domkazan-search.js',import.meta.url),'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function setup(options={}) {
  const dom=new JSDOM('<div id="search"></div><article data-domkazan-house="free"><span data-domkazan-price></span></article>',{url:'https://example.invalid/',runScripts:'outside-only'});
  dom.window.fetch=async()=>({ok:true,json:async()=>({houses:[{id:'free',slug:'free',name:'Synthetic',quote:{total:'10000',nights:2}}]})});
  dom.window.eval(script);
  const controller=dom.window.DomKazanCalendar.mount({root:dom.window.document.getElementById('search'),apiUrl:'https://example.invalid/api/availability',privacyUrl:'https://example.invalid/privacy',...options});
  return {dom,controller,shadow:dom.window.document.getElementById('search').shadowRoot};
}
test('range picker selects across year boundary in one opening, closes and returns focus',()=>{
  const {dom,controller,shadow}=setup();
  const year=new Date().getUTCFullYear()+1;
  const start=`${year}-12-31`,end=`${year+1}-01-02`;
  const trigger=shadow.querySelector('[aria-label="Заезд"]'); trigger.click();
  for(let i=0;i<24&&!shadow.querySelector(`[data-day="${start}"]`);i++)shadow.querySelector('[aria-label="Следующий месяц"]').click();
  shadow.querySelector(`[data-day="${start}"]`).click();
  assert.equal(shadow.querySelector('.calendar').hidden,false);
  assert.equal(shadow.querySelector('[name="checkIn"]').value,start);
  shadow.querySelector('[aria-label="Следующий месяц"]').click();
  shadow.querySelector(`[data-day="${end}"]`).click();
  assert.equal(shadow.querySelector('[name="checkOut"]').value,end);
  assert.equal(shadow.querySelector('.calendar').hidden,true);
  assert.equal(shadow.activeElement,trigger);
  assert.equal(shadow.querySelector('input[type="date"]'),null);
  controller.destroy();dom.window.close();
});
test('escape restores focus; impossible ranges do not reach API',async()=>{
  const {dom,controller,shadow}=setup();let calls=0;dom.window.fetch=async()=>{calls++;throw Error('should not fetch');};
  shadow.querySelector('[aria-label="Заезд"]').click();
  shadow.querySelector('.calendar').dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  assert.equal(shadow.querySelector('.calendar').hidden,true);
  const form=shadow.querySelector('form');form.elements.checkIn.value='2026-12-10';form.elements.checkOut.value='2026-12-09';
  form.dispatchEvent(new dom.window.Event('submit',{cancelable:true}));await flush();
  assert.equal(calls,0);assert.match(shadow.querySelector('.message').textContent,/Выберите период/);
  controller.destroy();dom.window.close();
});
test('house calendar distinguishes occupied and missing rate, and never crosses a blocked night',async()=>{
  const start=new Date(Date.now()+3*86400000).toISOString().slice(0,10);
  const middle=new Date(Date.parse(start)+86400000).toISOString().slice(0,10);
  const end=new Date(Date.parse(start)+2*86400000).toISOString().slice(0,10);
  const {dom,controller,shadow}=setup({calendarUrl:'https://example.invalid/api/house-calendar',houseSlug:'free'});
  dom.window.fetch=async()=>({ok:true,json:async()=>({days:[{date:start,status:'available',price:'1000',minNights:1},{date:middle,status:'occupied',price:'1000',minNights:1},{date:end,status:'unpriced',price:null,minNights:1}]})});
  shadow.querySelector('[aria-label="Заезд"]').click();await flush();
  assert.equal(shadow.querySelector(`[data-day="${middle}"]`)?.disabled,true);
  shadow.querySelector(`[data-day="${start}"]`).click();
  assert.equal(shadow.querySelector(`[data-day="${end}"]`)?.disabled,true);
  controller.destroy();dom.window.close();
});

test('failed submission preserves contacts and retries exactly the original idempotent payload',async()=>{
  const {dom,controller,shadow}=setup();const form=shadow.querySelector('form');
  form.elements.checkIn.value='2026-11-02';form.elements.checkOut.value='2026-11-04';
  form.dispatchEvent(new dom.window.Event('submit',{cancelable:true}));await flush();
  dom.window.document.querySelector('[data-domkazan-action-for] button').click();
  const request=shadow.querySelector('.request-form');request.elements.clientName.value='Synthetic';request.elements.clientPhone.value='+70000000000';request.elements.consent.checked=true;
  const payloads=[];dom.window.fetch=async(url,options)=>{payloads.push(JSON.parse(options.body));if(payloads.length===1)throw new Error('Temporary failure');return {ok:true,json:async()=>({requestId:'synthetic',message:'Received',contacts:{}})};};
  request.dispatchEvent(new dom.window.Event('submit',{cancelable:true}));await flush();
  assert.equal(request.elements.clientName.value,'Synthetic');assert.equal(request.hidden,false);
  request.dispatchEvent(new dom.window.Event('submit',{cancelable:true}));await flush();
  assert.deepEqual(payloads[0],payloads[1]);assert.equal(request.dataset.submitted,'true');assert.equal(request.elements.clientPhone.disabled,true);
  assert.equal(shadow.querySelector('.receipt').hidden,false);
  controller.destroy();dom.window.close();
});
