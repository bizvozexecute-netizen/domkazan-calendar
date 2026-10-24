import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { CLIENT_UI_DEFAULTS, clientUiSchema, contrast } from "../src/lib/client-ui.ts";

test("client settings allow only agreed plain text and accessible colors", () => {
  assert.ok(clientUiSchema.safeParse(CLIENT_UI_DEFAULTS).success);
  for (const key of ['primary','text'] as const) {
    assert.ok(contrast(CLIENT_UI_DEFAULTS.colors[key],'#FFFFFF') >= 4.5);
    assert.ok(contrast(CLIENT_UI_DEFAULTS.colors[key],CLIENT_UI_DEFAULTS.colors.background) >= 4.5);
  }
  for (const value of ['<script>alert(1)</script>','<img src=x onerror=alert(1)>','bad\u0000text','{secret}', 'x'.repeat(241),'']) {
    assert.equal(clientUiSchema.safeParse({...CLIENT_UI_DEFAULTS,texts:{...CLIENT_UI_DEFAULTS.texts,searchTitle:value}}).success,false);
  }
  for (const primary of ['red','url(https://example.invalid)','#FFFFFF','#99CCFF'])
    assert.equal(clientUiSchema.safeParse({...CLIENT_UI_DEFAULTS,colors:{...CLIENT_UI_DEFAULTS.colors,primary}}).success,false);
  assert.equal(clientUiSchema.safeParse({...CLIENT_UI_DEFAULTS,html:'unsafe'}).success,false);
  assert.equal(clientUiSchema.safeParse({...CLIENT_UI_DEFAULTS,texts:{...CLIENT_UI_DEFAULTS.texts,policy:'unsafe'}}).success,false);
  assert.equal(clientUiSchema.safeParse({...CLIENT_UI_DEFAULTS,texts:{...CLIENT_UI_DEFAULTS.texts,videoButton:'x'.repeat(41)}}).success,false);
  assert.equal(clientUiSchema.safeParse({...CLIENT_UI_DEFAULTS,colors:{primary:'#000000',text:'#000000',background:'#999999'}}).success,false);
});

test("browser defaults stay synchronized; untrusted settings cannot introduce markup or CSS", () => {
  const dom=new JSDOM('<div id="root"></div>',{url:'https://example.invalid',runScripts:'outside-only'});
  try {
    dom.window.eval(readFileSync('public/embed/domkazan-search.js','utf8'));
    const api=(dom.window as unknown as {DomKazanCalendar:{defaultUi:unknown;applyUi:(root:Element,settings:unknown)=>typeof CLIENT_UI_DEFAULTS}}).DomKazanCalendar;
    assert.deepEqual(JSON.parse(JSON.stringify(api.defaultUi)),CLIENT_UI_DEFAULTS);
    const ui=api.applyUi(dom.window.document.getElementById('root')!,{colors:{primary:'red; color:red'},texts:{searchTitle:'<script>x</script>',videoButton:'Видео дома'}});
    assert.equal(ui.texts.searchTitle,CLIENT_UI_DEFAULTS.texts.searchTitle);
    assert.equal(ui.texts.videoButton,'Видео дома');
    assert.equal(dom.window.document.getElementById('root')!.style.getPropertyValue('--dk-accent'),CLIENT_UI_DEFAULTS.colors.primary);
  } finally {dom.window.close();}
});
