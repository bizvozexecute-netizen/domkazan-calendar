import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const origin = process.argv[2];
if (origin !== 'https://domkazan-calendar-tilda-test-gatewa.vercel.app') {
  throw new Error('Pass the reviewed public Tilda test gateway origin.');
}
const snapshot = JSON.parse(await readFile(new URL('../data/tilda-catalog-public.json', import.meta.url), 'utf8'));
if (snapshot.products.length !== 63) throw new Error('Review the current Tilda catalog before rendering.');
const mapping = snapshot.products.map(({ productUid }) => ({
  productUid, houseSlug: `tilda-${productUid}`, confirmed: true,
}));
const script = `(async () => {
  const config = {
    enabled: true,
    testPageId: "311744409",
    catalogRecordId: "rec4862082901",
    apiOrigin: "${origin}",
    privacyUrl: "${origin}/test-policy",
    mapping: ${JSON.stringify(mapping)},
  };
  const status = document.getElementById("domkazan-test-status");
  if (!config.enabled) return;
  try {
    if (document.readyState === "loading") {
      await new Promise(resolve => document.addEventListener("DOMContentLoaded", resolve, { once: true }));
    }
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
    status.textContent = "Тестовый календарь подключён. Занятость и суммы демонстрационные, бронирование не подтверждают. Для заявки: Тестовый Гость, +70000000000.";
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "Не удалось подключить тестовый календарь.";
  }
})();`;
new Script(script);
const snippet = `<!-- DomKazan Calendar: only test page 311744409. Public gateway serves synthetic data only. -->
<style>
  #rec4862390501 { background:#f4f7f4; padding:28px 16px 32px; }
  #domkazan-test-search, #domkazan-test-status { max-width:1180px; margin-left:auto; margin-right:auto; }
  #domkazan-test-status { margin-top:12px; padding:12px 16px; border-left:4px solid #176348; border-radius:6px; background:#e7f1e9; color:#315546; font:14px/1.5 Arial,sans-serif; }
</style>
<div id="domkazan-test-search"></div>
<p id="domkazan-test-status" role="status">Тестовый календарь: занятость и суммы демонстрационные, бронирование не подтверждают. Для заявки используйте только «Тестовый Гость» и +70000000000.</p>
<script>
${script}
</script>`;
const output = fileURLToPath(new URL('../../tilda-311744409-t123.html', import.meta.url));
await writeFile(output, snippet, 'utf8');
console.log(`T123 prepared: ${mapping.length} confirmed UID-to-test-slug rows, enabled=true, ${snippet.length} characters.`);
