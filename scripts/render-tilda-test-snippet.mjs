import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const origin = process.argv[2];
if (!origin || !/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin) || !origin.includes('domkazan-calendar-test-')) {
  throw new Error('Pass the exact protected Vercel Preview origin.');
}
const snapshot = JSON.parse(await readFile(new URL('../data/tilda-catalog-public.json', import.meta.url), 'utf8'));
if (snapshot.products.length !== 63) throw new Error('Review the current Tilda catalog before rendering.');
const mapping = snapshot.products.map(({ productUid }) => ({
  productUid, houseSlug: `tilda-${productUid}`, confirmed: true,
}));
const script = `(async () => {
  const config = {
    enabled: false,
    testPageId: "311744409",
    catalogRecordId: "rec4862082901",
    apiOrigin: "${origin}",
    privacyUrl: "${origin}/test-policy",
    mapping: ${JSON.stringify(mapping)},
  };
  const status = document.getElementById("domkazan-test-status");
  if (!config.enabled) return;
  try {
    const page = document.querySelector("[data-tilda-page-id]");
    if (page?.getAttribute("data-tilda-page-id") !== config.testPageId || config.testPageId === "70446131") throw new Error("Только тестовая копия страницы.");
    const origin = new URL(config.apiOrigin);
    const policy = new URL(config.privacyUrl);
    if (origin.protocol !== "https:" || policy.protocol !== "https:") throw new Error("Нужен HTTPS тестовый API и политика.");
    const catalog = document.getElementById(config.catalogRecordId);
    if (!catalog) throw new Error("Каталог тестовой страницы не найден.");
    if (!config.mapping.length || config.mapping.some(row => row.confirmed !== true)) throw new Error("Проверьте Product UID.");
    for (const file of ["domkazan-search.js", "domkazan-tilda.js"]) {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = new URL("/embed/" + file, origin).href;
        script.onload = resolve;
        script.onerror = () => reject(new Error("Модуль календаря недоступен."));
        document.head.append(script);
      });
    }
    window.domkazanTestCatalog = window.DomKazanTilda.mount({
      root: document.getElementById("domkazan-test-search"), catalog,
      mapping: config.mapping,
      apiUrl: new URL("/api/availability", origin).href,
      privacyUrl: policy.href,
      getFilters: () => ({}),
    });
    status.textContent = "Тестовый календарь подключён. Только вымышленные заявки. Занятость и суммы тестовые.";
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "Не удалось подключить тестовый календарь.";
  }
})();`;
new Script(script);
const snippet = `<!-- DomKazan Calendar: only test page 311744409. Disabled until a separate test API is accessible from Tilda. -->
<div id="domkazan-test-search"></div>
<p id="domkazan-test-status" role="status">Интеграция подготовлена и выключена. Занятость и расчёт цен пока тестовые.</p>
<script>
${script}
</script>`;
const output = fileURLToPath(new URL('../../tilda-311744409-t123.html', import.meta.url));
await writeFile(output, snippet, 'utf8');
console.log(`T123 prepared: ${mapping.length} confirmed UID-to-test-slug rows, enabled=false, ${snippet.length} characters.`);
