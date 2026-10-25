import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Script} from 'node:vm';
import {renderTildaTestSnippet} from './render-tilda-test-snippet.mjs';

// These IDs were read in the working page editor. Replace the old HomeReserve
// T123, rather than adding a second booking system beside it.
export async function renderTildaProductionSnippet(policyUrl) {
  const origin='https://45.147.31.241';
  const policy=new URL(policyUrl);
  if(policy.origin!==origin||!['/privacy','/privacy-2026-10-26.html'].includes(policy.pathname)||policy.search||policy.hash||policy.username||policy.password)
    throw new Error('Use the reviewed production policy URL');
  let snippet=await renderTildaTestSnippet('https://domkazan-calendar-tilda-test-gatewa.vercel.app');
  const replacements=[
    ['https://domkazan-calendar-tilda-test-gatewa.vercel.app',origin],
    ['/calendar-test-311744409','/'],
    ['311744409','70446131'],
    ['rec4862390501','rec1184803096'],
    ['rec4862082401','rec1088252761'],
    ['rec4862082801','rec1096886496'],
    ['testMode:true,embedded:true',`testMode:false,privacyUrl:${JSON.stringify(policy.href)},consentUrl:${JSON.stringify(origin+'/consent-2026-10-26.html')},embedded:true`],
    ['Test page 70446131 only.','Working page 70446131 only.'],
    ['restricted to the isolated Tilda test page.','restricted to the reviewed working Tilda page.'],
  ];
  for(const [from,to] of replacements){
    if(!snippet.includes(from))throw new Error('Bootstrap contract changed: review production mapping');
    snippet=snippet.replaceAll(from,to);
  }
  const failureMarker='mounted?.destroy();\n    status.hidden = false;';
  if(!snippet.includes(failureMarker))throw new Error('Review the production fallback contract');
  snippet=snippet.replace(failureMarker,`mounted?.destroy();
    // The legacy catalog contains links used during acceptance. On failure,
    // direct clients to the existing public phone rather than a test booking form.
    for(const anchor of page.querySelectorAll('#rec4148990801 a[href]'))try{
      const url=new URL(anchor.href,location.href);
      if(url.origin===location.origin&&url.pathname.startsWith('/calendar-test-')){
        anchor.href='tel:+79053106605';anchor.textContent='Уточнить по телефону';anchor.removeAttribute('target');
      }
    }catch{/* Leave unrelated Tilda links untouched. */}
    status.hidden = false;`);
  // The old page has a separate negative-margin helper for its hero.
  snippet=snippet.replace('</style>',`#allrecords:is(.dkcal-pending,.dkcal-ready)[data-tilda-page-id="70446131"] { display:flex; flex-direction:column; }
#allrecords:is(.dkcal-pending,.dkcal-ready)[data-tilda-page-id="70446131"] > #rec1088252761 { order:1; }
#allrecords:is(.dkcal-pending,.dkcal-ready)[data-tilda-page-id="70446131"] > #rec1096886496 { order:2; margin-top:0 !important; }
#allrecords:is(.dkcal-pending,.dkcal-ready)[data-tilda-page-id="70446131"] > #rec1184803096 { order:3; }
</style>`);
  new Script(snippet.match(/<script>([\s\S]*)<\/script>/)[1]);
  if(/testMode:true|4862390501|4862082401|4862082801|homereserve\.ru/.test(snippet))throw new Error('Test or legacy integration leaked into production');
  return snippet;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const snippet=await renderTildaProductionSnippet(process.argv[2]);
  await writeFile(new URL('../integration/tilda-70446131-t123.html',import.meta.url),snippet,'utf8');
  console.log('Prepared the working-page snippet. No Tilda page was changed or published.');
}
