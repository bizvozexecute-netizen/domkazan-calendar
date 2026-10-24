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
  // Keep its existing viewport guard for the old anchor observer; the scoped
  // snippet CSS retains the header and its independently initialized burger.
  // Do not patch Tilda
  // functions, ResizeObserver, or error handlers. Restore the attribute on failure.
  const navigation = document.getElementById('rec4862082401');
  const previousScreenMax = navigation?.getAttribute('data-screen-max');
  navigation?.setAttribute('data-screen-max', '0');
  page.classList.add('dkcal-pending');
  status.hidden = false;
  const controller = new AbortController();
  let active = true, mounted;
  const timer = setTimeout(() => fail(), 30000);
  const slowTimer=setTimeout(()=>{if(active&&!page.classList.contains('dkcal-ready'))status.textContent='Загрузка занимает больше времени. Проверяем соединение…';},8000);
  function mode(){page.classList.toggle('dkcal-detail',new URLSearchParams(location.search).has('house'));}
  mode();window.addEventListener('popstate',mode);root.addEventListener('domkazan:ready',mode);

  function restore() {
    page.classList.remove('dkcal-pending', 'dkcal-ready','dkcal-detail');
    if (navigation) {
      if (previousScreenMax === null) navigation.removeAttribute('data-screen-max');
      else navigation.setAttribute('data-screen-max', previousScreenMax);
    }
  }
  function fail() {
    if (!active) return;
    active = false; clearTimeout(timer);clearTimeout(slowTimer); controller.abort(); restore();
    mounted?.destroy();
    status.hidden = false;
    status.textContent = 'Не удалось загрузить поиск. Доступность домов не проверена. Ниже доступен обычный каталог Tilda. ';
    const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = 'Повторить загрузку';
    retry.addEventListener('click', () => location.reload()); status.append(retry);
  }
  function ready() {
    if (!active) return;
    if (page.classList.contains('dkcal-pending')) performance.measure('domkazan:startup-to-ready', 'domkazan:startup');
    clearTimeout(timer);clearTimeout(slowTimer); page.classList.replace('dkcal-pending', 'dkcal-ready');
    status.hidden = true;
  }
  root.addEventListener('domkazan:ready', ready);
  root.addEventListener('domkazan:error', fail);
  async function loadScript(file, present) {
    if (present) return Promise.resolve();
    for(let attempt=0;attempt<2;attempt++)try{return await new Promise((resolve, reject) => {
      // Dynamic ordered scripts still download together. WebKit may hold an
      // explicitly async script until first paint / DOMContentLoaded, behind
      // unrelated Tilda defer scripts. This queue can execute before either.
      const script = document.createElement('script'); script.async = false;
      const deadline=setTimeout(()=>finish(new Error('Script timeout')),8000);
      const finish = (error) => {
        clearTimeout(deadline);
        script.onload = script.onerror = null; controller.signal.removeEventListener('abort', cancelled);
        if (error) { script.remove(); reject(error); } else resolve();
      };
      const cancelled = () => finish(new Error('Startup cancelled'));
      script.onload = () => finish(); script.onerror = () => finish(new Error('Script unavailable'));
      controller.signal.addEventListener('abort', cancelled, {once:true});
      script.src = `${apiOrigin}/embed/${file}${attempt?'?retry=1':''}`; document.head.append(script);
    });}catch(error){if(controller.signal.aborted||attempt===1)throw error;}
  }

  // Fetch public content and both independent modules at once, without waiting
  // for unrelated Tilda images/scripts or DOMContentLoaded. Availability and
  // booking totals continue to come from fresh server requests after a search.
  async function readCatalog(path) {
    for(let attempt=0;attempt<2;attempt++){
      const request=new AbortController(),deadline=setTimeout(()=>request.abort(),5000);
      const cancelled=()=>request.abort();controller.signal.addEventListener('abort',cancelled,{once:true});
      try{return await fetch(`${apiOrigin}${path}`, {signal:request.signal,cache:'no-store'})
      .then(response => { if (!response.ok) throw new Error('Catalog unavailable'); return response.json(); })
      .then(data => { if (!Array.isArray(data?.products)) throw new Error('Invalid catalog'); return data; });}
      catch(error){if(controller.signal.aborted||attempt===1)throw error;}
      finally{clearTimeout(deadline);controller.signal.removeEventListener('abort',cancelled);}
    }
  }
  const catalogData = readCatalog('/api/catalog');
  // Public metadata is a small CDN request, outside Tilda's HTML block limit.
  // Race it with the live origin; either source can recover from the other failing.
  // Prices/occupancy are never read from this cache to authorize a request.
  const initial = readCatalog('/embed/domkazan-catalog-initial.json');
  const firstCatalog = Promise.any([initial, catalogData]);
  Promise.all([
    loadScript('domkazan-search.js', window.DomKazanCalendar),
    loadScript('domkazan-catalog.js', window.DomKazanCatalog),
    firstCatalog,
  ]).then(([, , data]) => {
    if (active) mounted = window.DomKazanCatalog.mount({root, apiOrigin, pagePath, testMode:true,embedded:true, catalogData:data,
      refreshCatalogData:catalogData});
  }).catch(fail);

  window.domkazanTestCatalog = {
    destroy() {
      active = false; clearTimeout(timer);clearTimeout(slowTimer); controller.abort(); mounted?.destroy(); restore();
      window.removeEventListener('popstate',mode);root.removeEventListener('domkazan:ready',mode);
      root.removeEventListener('domkazan:ready', ready); root.removeEventListener('domkazan:error', fail);
    },
  };
})();
