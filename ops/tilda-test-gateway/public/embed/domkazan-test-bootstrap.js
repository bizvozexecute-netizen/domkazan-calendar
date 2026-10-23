/* Inlined by render-tilda-test-snippet.mjs; restricted to the isolated Tilda test page. */
(() => {
  const apiOrigin = 'https://domkazan-calendar-tilda-test-gatewa.vercel.app';
  const pagePath = '/calendar-test-311744409';
  const page = document.querySelector('#allrecords[data-tilda-page-id="311744409"]');
  const root = document.getElementById('domkazan-catalog');
  const status = document.getElementById('domkazan-test-status');
  if (location.origin !== 'https://domkazan116.ru' || location.pathname !== pagePath ||
      !page || !root?.closest('#rec4862390501') || !status) return;

  window.domkazanTestCatalog?.destroy();
  performance.mark('domkazan:startup');
  // Tilda's anchor menu starts a BODY ResizeObserver at DOMContentLoaded.
  // This exact menu is replaced by the catalog navigation on this test page.
  // Use its existing viewport guard before initialization; do not patch Tilda
  // functions, ResizeObserver, or error handlers. Restore the attribute on failure.
  const navigation = document.getElementById('rec4862082401');
  const previousScreenMax = navigation?.getAttribute('data-screen-max');
  navigation?.setAttribute('data-screen-max', '0');
  page.classList.add('dkcal-pending');
  status.hidden = false;
  const controller = new AbortController();
  const apiTimer = setTimeout(() => controller.abort(), 10000);
  let active = true, mounted;
  const timer = setTimeout(() => fail(), 10000);

  function restore() {
    page.classList.remove('dkcal-pending', 'dkcal-ready');
    if (navigation) {
      if (previousScreenMax === null) navigation.removeAttribute('data-screen-max');
      else navigation.setAttribute('data-screen-max', previousScreenMax);
    }
  }
  function fail() {
    if (!active) return;
    active = false; clearTimeout(timer); clearTimeout(apiTimer); controller.abort(); restore();
    mounted?.destroy();
    status.hidden = false;
    status.textContent = 'Тестовый каталог временно недоступен. Ниже доступен обычный каталог Tilda. ';
    const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = 'Повторить загрузку';
    retry.addEventListener('click', () => location.reload()); status.append(retry);
  }
  function ready() {
    if (!active) return;
    if (page.classList.contains('dkcal-pending')) performance.measure('domkazan:startup-to-ready', 'domkazan:startup');
    clearTimeout(timer); page.classList.replace('dkcal-pending', 'dkcal-ready');
    status.hidden = true;
  }
  root.addEventListener('domkazan:ready', ready);
  root.addEventListener('domkazan:error', fail);
  function loadScript(file, present) {
    if (present) return Promise.resolve();
    return new Promise((resolve, reject) => {
      // Dynamic ordered scripts still download together. WebKit may hold an
      // explicitly async script until first paint / DOMContentLoaded, behind
      // unrelated Tilda defer scripts. This queue can execute before either.
      const script = document.createElement('script'); script.async = false;
      const finish = (error) => {
        script.onload = script.onerror = null; controller.signal.removeEventListener('abort', cancelled);
        if (error) { script.remove(); reject(error); } else resolve();
      };
      const cancelled = () => finish(new Error('Startup cancelled'));
      script.onload = () => finish(); script.onerror = () => finish(new Error('Script unavailable'));
      controller.signal.addEventListener('abort', cancelled, {once:true});
      script.src = `${apiOrigin}/embed/${file}`; document.head.append(script);
    });
  }

  // Fetch public content and both independent modules at once, without waiting
  // for unrelated Tilda images/scripts or DOMContentLoaded. Availability and
  // booking totals continue to come from fresh server requests after a search.
  const catalogData = fetch(`${apiOrigin}/api/catalog`, {signal:controller.signal})
    .then(response => { if (!response.ok) throw new Error('Catalog unavailable'); return response.json(); })
    .finally(() => clearTimeout(apiTimer));
  // This contains public content only, prepared from Tilda. Revalidate in the
  // background so an origin cold start cannot delay the first usable screen.
  // Prices/occupancy are never read from this cache to authorize a request.
  let initial;
  try { initial=JSON.parse(document.getElementById('domkazan-catalog-initial')?.textContent); }
  catch { /* A missing/invalid cache falls back to the live content request. */ }
  if (!Array.isArray(initial?.products) || !initial.products.length) initial=undefined;
  catalogData.catch(() => {}); // Handled below or by the non-blocking refresh.
  Promise.all([
    loadScript('domkazan-search.js', window.DomKazanCalendar),
    loadScript('domkazan-catalog.js', window.DomKazanCatalog),
    initial || catalogData,
  ]).then(([, , data]) => {
    if (active) mounted = window.DomKazanCatalog.mount({root, apiOrigin, pagePath, testMode:true, catalogData:data,
      refreshCatalogData:initial?catalogData:undefined});
  }).catch(fail);

  window.domkazanTestCatalog = {
    destroy() {
      active = false; clearTimeout(timer); clearTimeout(apiTimer); controller.abort(); mounted?.destroy(); restore();
      root.removeEventListener('domkazan:ready', ready); root.removeEventListener('domkazan:error', fail);
    },
  };
})();
