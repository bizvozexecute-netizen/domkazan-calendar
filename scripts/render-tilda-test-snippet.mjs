import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const origin = process.argv[2];
if (origin !== 'https://domkazan-calendar-tilda-test-gatewa.vercel.app') throw new Error('Pass the reviewed test gateway origin.');
const script = `(async () => {
  const root = document.getElementById('domkazan-catalog');
  const status = document.getElementById('domkazan-test-status');
  try {
    if (document.readyState === 'loading') await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, {once:true}));
    const page = document.querySelector('[data-tilda-page-id]');
    if (page?.getAttribute('data-tilda-page-id') !== '311744409') return;
    root.addEventListener('domkazan:ready', () => { page.classList.add('dkcal-ready'); status.hidden = true; });
    root.addEventListener('domkazan:error', () => { page.classList.remove('dkcal-ready'); status.hidden = false; });
    for (const file of ['domkazan-search.js', 'domkazan-catalog.js']) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = '${origin}/embed/' + file;
        script.onload = resolve; script.onerror = () => reject(new Error('Каталог временно недоступен.'));
        document.head.append(script);
      });
    }
    window.domkazanTestCatalog = window.DomKazanCatalog.mount({root, apiOrigin:'${origin}', pagePath:'/calendar-test-311744409', testMode:true});
  } catch(error) { status.textContent = error.message || 'Не удалось загрузить каталог.'; }
})();`;
new Script(script);
const snippet = `<!-- DomKazan: page-local catalog and individual house URLs. Test page 311744409 only. -->
<style>
  #rec4862390501 { padding:0 !important; margin:0 !important; background:#f6f8fb; }
  #allrecords.dkcal-ready[data-tilda-page-id="311744409"] > .r:not(#rec4862390501) { display:none !important; }
  #domkazan-test-status { padding:20px; font:14px Arial,sans-serif; }
</style>
<div id="domkazan-catalog"></div>
<p id="domkazan-test-status" role="status">Загружаем тестовый каталог. Если он недоступен, ниже остаётся обычный каталог Tilda.</p>
<script>${script}</script>`;
await writeFile(fileURLToPath(new URL('../../tilda-311744409-t123.html', import.meta.url)), snippet, 'utf8');
console.log(`T123 prepared: test page 311744409, catalog and house pages, ${snippet.length} characters.`);
