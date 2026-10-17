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
    status.textContent = "Цены и занятость демонстрационные. Для проверки заявки: Тестовый Гость, +70000000000. Бронирование не создаётся.";
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "Не удалось подключить тестовый календарь.";
  }
})();`;
new Script(script);
const snippet = `<!-- DomKazan Calendar: only test page 311744409. Public gateway serves synthetic data only. -->
<style>
  #nav4862082401 { position:absolute !important; }
  #rec4862390501 { background:#f6f7f3; padding:52px 20px 56px; }
  #rec4862390501 .dkcal-shell { max-width:1160px; margin:0 auto; font-family:Arial,sans-serif; }
  #rec4862390501 .dkcal-intro { margin:0 0 26px; }
  #rec4862390501 .dkcal-kicker { display:inline-block; margin-bottom:12px; color:#2e7153; font-size:12px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; }
  #rec4862390501 .dkcal-intro h2 { margin:0 0 10px; color:#173b2c; font:700 clamp(28px,3.5vw,38px)/1.16 Arial,sans-serif; }
  #rec4862390501 .dkcal-intro p { margin:0; color:#627469; font:16px/1.55 Arial,sans-serif; }
  #rec4862390501 .dkcal-panel { padding:30px; border:1px solid #e1e8e1; border-radius:20px; background:#fff; box-shadow:0 18px 42px rgba(24,57,39,.08); }
  #rec4862390501 #domkazan-test-status { margin:20px 0 0; padding:14px 16px; border:1px solid #dbe8dc; border-radius:10px; background:#f5faf5; color:#52685a; font:13px/1.5 Arial,sans-serif; }
  #rec4862390501 #domkazan-test-status:before { content:'ТЕСТОВЫЙ РЕЖИМ'; display:block; margin-bottom:5px; color:#2b7150; font-size:11px; font-weight:700; letter-spacing:.1em; }
  #rec4862082901 { background-color:#f6f7f3 !important; }
  #rec4862082901 .t-section__title { color:#173b2c; font-family:Arial,sans-serif; }
  #rec4862082901 .t-store__card__wrap_all { border-radius:16px 16px 0 0; overflow:hidden; }
  #rec4862082901 [data-domkazan-tilda-slot] { padding:14px 18px 18px !important; border-radius:0 0 16px 16px; background:#fff; box-shadow:0 12px 22px rgba(24,57,39,.07); }
  #rec4862082901 [data-domkazan-tilda-slot] p { margin:0; color:#52685a; font-size:14px; line-height:1.4; }
  #rec4862082901 .t-store__card__title { color:#173b2c; font-weight:700; }
  #rec4862082901 .t-store__card__btn { background-color:#1c6047 !important; border-radius:10px !important; }
  @media(max-width:760px) {
    #rec4862390501 { padding:34px 16px 42px; }
    #rec4862390501 .dkcal-intro { margin-bottom:20px; }
    #rec4862390501 .dkcal-panel { padding:18px; border-radius:16px; }
  }
</style>
<div class="dkcal-shell">
  <div class="dkcal-intro">
    <span class="dkcal-kicker">Тестовый подбор домов</span>
    <h2>Найдите дом на нужные даты</h2>
    <p>Укажите даты поездки и количество гостей — покажем подходящие варианты.</p>
  </div>
  <div class="dkcal-panel">
    <div id="domkazan-test-search"></div>
    <p id="domkazan-test-status" role="status">Цены и занятость демонстрационные. Для проверки заявки: Тестовый Гость, +70000000000. Бронирование не создаётся.</p>
  </div>
</div>
<script>
${script}
</script>`;
const output = fileURLToPath(new URL('../../tilda-311744409-t123.html', import.meta.url));
await writeFile(output, snippet, 'utf8');
console.log(`T123 prepared: ${mapping.length} confirmed UID-to-test-slug rows, enabled=true, ${snippet.length} characters.`);
