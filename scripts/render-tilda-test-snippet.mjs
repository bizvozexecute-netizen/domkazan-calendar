import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { Script } from 'node:vm';

export async function renderTildaTestSnippet(origin) {
if (origin !== 'https://domkazan-calendar-tilda-test-gatewa.vercel.app') throw new Error('Pass the reviewed test gateway origin.');
const script = await readFile(new URL('../public/embed/domkazan-test-bootstrap.js', import.meta.url), 'utf8');
const initial = JSON.stringify(JSON.parse(await readFile(new URL('../data/tilda-catalog-initial.json', import.meta.url),'utf8'))).replace(/</g,'\\u003c');
new Script(script);
return `<!-- DomKazan: page-local catalog and individual house URLs. Test page 311744409 only. -->
<link rel="preconnect" href="${origin}" crossorigin>
<style>
  #rec4862390501 { padding:0 !important; margin:0 !important; background:#f6f8fb; }
  #allrecords:is(.dkcal-pending,.dkcal-ready)[data-tilda-page-id="311744409"] > .r:not(#rec4862390501) { display:none !important; }
  #domkazan-test-status { margin:0; padding:32px 20px; font:14px/1.6 Arial,sans-serif; color:#42576e; }
  #domkazan-test-status button { min-height:44px; margin:12px 0 0; padding:8px 16px; cursor:pointer; }
</style>
<div id="domkazan-catalog"></div>
<p id="domkazan-test-status" role="status">Загружаем каталог домов…</p>
<script id="domkazan-catalog-initial" type="application/json">${initial}</script>
<script>${script}</script>`;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const snippet = await renderTildaTestSnippet(process.argv[2]);
  const destination = new URL('../integration/tilda-311744409-t123.html', import.meta.url);
  await mkdir(new URL('./', destination), {recursive:true});
  await writeFile(destination, snippet, 'utf8');
  console.log(`Prepared ${fileURLToPath(destination)} (${snippet.length} characters). No Tilda page was changed.`);
}
