/* Tilda remains the content editor. Calendar quotes and requests come from DomKazan. */
(() => {
  const searchLabels = { pool: 'Бассейн', sauna: 'Баня / сауна', billiards: 'Бильярд' };
  const rub = value => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(Number(value));
  const plural = (value, forms) => forms[value % 100 >= 11 && value % 100 <= 14 ? 2 : value % 10 === 1 ? 0 : value % 10 >= 2 && value % 10 <= 4 ? 1 : 2];
  const css = `
    :host{display:block;--dk-accent:#218df1;color:#192a3a;font:16px/1.5 Arial,sans-serif;background:#f6f8fb}
    *{box-sizing:border-box} [hidden]{display:none!important} a{color:inherit;text-decoration:none} button,input,select{font:inherit} button,a,input,select,summary{-webkit-tap-highlight-color:transparent} button,a{touch-action:manipulation} button{cursor:pointer} button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible{outline:3px solid #9cd0ff;outline-offset:3px}
    .shell{max-width:1200px;margin:auto;padding:36px 24px 64px}.top{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:32px}.brand{font-size:23px;font-weight:800;letter-spacing:-1px}.brand span{color:var(--dk-accent)}.city{margin-left:16px;color:#7b8795;font-size:14px;font-weight:400;letter-spacing:0}.top-contact{font-size:15px;font-weight:700}.intro{margin:0 0 24px}.eyebrow{font-size:12px;letter-spacing:.12em;color:#637b90;text-transform:uppercase;font-weight:700}h1{margin:8px 0 10px;font-size:clamp(28px,3.7vw,42px);line-height:1.16;letter-spacing:-1px}.subtitle{margin:0;color:#708091;font-size:16px}.search{padding:22px 24px;border:1px solid #e6ecf1;border-radius:16px;background:#fff;box-shadow:0 8px 24px #233d5810}.test-note{display:flex;align-items:baseline;gap:10px;margin:15px 0 28px;color:#7a8795;font-size:12px}.test-note b{flex-shrink:0;color:#486c94;background:#eaf2fb;border-radius:5px;padding:3px 7px;font-size:11px}.toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:26px 0 16px}.count{font-size:20px;font-weight:700}.view{display:flex;border:1px solid #e1e7ee;border-radius:9px;padding:3px;background:#fff}.view button{border:0;background:transparent;border-radius:6px;padding:7px 12px;color:#728193;font-size:13px}.view button[aria-pressed=true]{background:#eaf3ff;color:#1769b6;font-weight:700}.filters{border:1px solid #e2e8ef;background:#fff;border-radius:12px;margin-bottom:20px;padding:16px 20px}.filters summary{font-size:14px;font-weight:700;cursor:pointer}.filter-fields{display:grid;grid-template-columns:2fr 1fr 1fr 1.4fr;gap:14px;margin-top:16px}.filter-fields label{display:grid;gap:5px;color:#768494;font-size:12px}.filter-fields input,.filter-fields select{width:100%;min-width:0;height:42px;border:1px solid #e1e6ec;border-radius:7px;padding:8px 10px;background:#fff;color:#23384c;font-size:14px}.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}.chip{display:flex;align-items:center;gap:7px;border:1px solid #e1e8f0;border-radius:7px;padding:7px 11px;font-size:13px;color:#536579;cursor:pointer}.chip:has(input:checked){background:#edf5ff;border-color:#85baff;color:#1769b6}.chip input{accent-color:var(--dk-accent)}.reset{border:0;background:transparent;color:#2486df;font-size:13px;padding:8px}.cards{display:grid;gap:18px}.card{display:grid;grid-template-columns:300px minmax(0,1fr) 225px;background:#fff;border:1px solid #e9edf2;border-radius:15px;overflow:hidden;box-shadow:0 5px 18px #233d5807}.cover{display:block;min-height:235px;background:#e9eef4;position:relative}.cover img{width:100%;height:100%;min-height:235px;max-height:280px;object-fit:cover;display:block;transition:transform .2s}.cover:hover img{transform:scale(1.025)}.photo-count{position:absolute;bottom:12px;left:14px;border-radius:5px;padding:3px 8px;background:#14222eaa;color:white;font-size:11px}.info{padding:26px 25px}.info h2{margin:0 0 14px;font-size:23px;line-height:1.2;letter-spacing:-.4px}.info h2 a:hover{color:#218df1}.facts{display:flex;gap:8px 16px;flex-wrap:wrap;color:#5b6b7d;font-size:13px;margin-bottom:16px}.facts span{white-space:nowrap}.amenities{display:flex;gap:6px;flex-wrap:wrap;list-style:none;padding:0;margin:0 0 19px}.amenities li{background:#f3f6f9;border-radius:5px;padding:4px 8px;font-size:11px;color:#66788a}.details-link{font-size:14px;font-weight:700;color:#2288e6}.price-area{padding:26px 22px;border-left:1px solid #edf0f4;display:flex;flex-direction:column;justify-content:space-between;gap:16px}.price{margin:0;font-size:24px;font-weight:700;letter-spacing:-.5px;line-height:1.2;color:#172c40}.price small{display:block;font-size:12px;font-weight:400;letter-spacing:0;color:#7d8b9b;margin-top:7px}.price-area [data-domkazan-action-for] button{width:100%;font-size:13px!important;font-weight:700!important;margin:0!important;min-height:44px}.empty{padding:48px 20px;text-align:center;background:white;border:1px dashed #d5e0eb;border-radius:14px}.empty h2{margin:0 0 8px;font-size:22px}.empty p{color:#758496;margin:0 0 18px}.cards.grid{grid-template-columns:repeat(3,minmax(0,1fr))}.grid .card{grid-template-columns:1fr}.grid .cover{min-height:210px}.grid .cover img{height:210px;min-height:210px}.grid .info{padding:20px}.grid .price-area{border-left:0;border-top:1px solid #edf0f4;padding:18px 20px}.grid .info h2{font-size:21px}.back{display:inline-flex;align-items:center;gap:8px;color:#66809a;font-size:14px;margin-bottom:18px}.gallery{display:grid;grid-template-columns:minmax(0,1fr) 165px;gap:10px;margin:26px 0}.main-photo{width:100%;height:480px;object-fit:cover;border-radius:16px;background:#e7edf4}.thumbs{display:grid;grid-template-columns:1fr 1fr;gap:8px;align-content:start;max-height:480px;overflow:auto}.thumbs button{padding:0;border:2px solid transparent;border-radius:8px;background:none;overflow:hidden}.thumbs button[aria-pressed=true]{border-color:var(--dk-accent)}.thumbs img{display:block;width:100%;height:77px;object-fit:cover}.house-layout{display:grid;grid-template-columns:minmax(0,1fr) 400px;gap:32px;align-items:start}.house-copy{background:white;border:1px solid #e5ebf1;border-radius:16px;padding:30px}.house-copy h2{margin:0 0 18px;font-size:23px}.house-copy p{white-space:pre-line;color:#5f7183;margin:0;line-height:1.9}.house-copy .amenities{margin-bottom:24px}.booking{position:sticky;top:20px}.booking .search{padding:22px}.booking h2{margin:0 0 18px;font-size:21px}.booking-quote{background:white;padding:0 22px 22px;border:1px solid #e6ecf1;border-top:0;border-radius:0 0 16px 16px;margin-top:-12px}.breakdown{color:#7b8896;font-size:12px;margin-top:12px}.contacts{display:flex;flex-wrap:wrap;gap:8px;margin-top:20px}.contacts a{padding:10px 13px;border:1px solid #dce6ef;border-radius:8px;font-size:13px;font-weight:700;color:#2884d5}.contacts a:hover{background:#eff6ff}.contact-note{font-size:12px;color:#7e8b98;margin:13px 0 0}.footer-note{font-size:13px;color:#7e8c9b;text-align:center;margin:36px 0 0}.error{background:#fff0ed;border:1px solid #f6d2c8;padding:18px;border-radius:12px;color:#8d422c}.loading{padding:60px;text-align:center;color:#718297}
    @media(max-width:1050px){.card{grid-template-columns:245px minmax(0,1fr) 200px}.info{padding:22px 18px}.price-area{padding:22px 18px}.cards.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.house-layout{grid-template-columns:minmax(0,1fr) 350px}.main-photo{height:400px}.filter-fields{grid-template-columns:1fr 1fr}}
    @media(max-width:760px){.shell{padding:24px 16px 40px}.top{margin-bottom:26px}.brand{font-size:21px}.city{display:none}.top-contact{font-size:12px}.intro{margin-bottom:20px}h1{font-size:30px;letter-spacing:-.6px}.subtitle{font-size:14px}.search{padding:18px 16px}.test-note{align-items:start;margin-bottom:20px}.filters{padding:14px}.filter-fields{gap:10px}.filter-fields label:first-child{grid-column:1/-1}.chip{font-size:12px;padding:6px 8px}.toolbar{margin-top:20px}.count{font-size:18px}.card,.cards.grid .card{grid-template-columns:1fr}.cards.grid{grid-template-columns:1fr}.cover,.cover img,.grid .cover,.grid .cover img{height:220px;min-height:220px;max-height:none}.info{padding:20px 20px 14px}.info h2{font-size:23px;margin-bottom:12px}.amenities{margin-bottom:16px}.price-area{border-left:0;border-top:1px solid #edf0f4;padding:18px 20px;display:grid;grid-template-columns:1fr 1fr;align-items:center}.price{font-size:22px}.price-area [data-domkazan-action-for] button{font-size:12px!important;padding:12px!important}.view{display:none}.house-layout{grid-template-columns:1fr;gap:20px}.booking{position:static;grid-row:1}.gallery{grid-template-columns:1fr;margin:20px 0}.main-photo{height:280px;border-radius:12px}.thumbs{grid-template-columns:repeat(6,90px);overflow:auto;max-height:90px}.thumbs img{height:65px}.house-copy{padding:22px}.house-copy h2{font-size:21px}.booking .search{padding:20px}.booking-quote{display:block}.contacts a{flex:1;text-align:center}.empty{padding:32px 20px}}
    .view{display:none}.intro:empty{display:none}.gallery{display:block}.booking{position:static}.house-layout .booking{grid-row:auto}
    .description-preview{font-size:14px;line-height:1.6;color:#5b6b7d;margin:0 0 14px;white-space:pre-line}
    .toolbar h2{font:inherit;margin:0}.sort-control{display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:14px}
    .sort-control select{padding:10px;border:1px solid #dce6ef;border-radius:8px;background:white;max-width:100%}
    @media(max-width:760px){.toolbar{align-items:flex-start;flex-direction:column}.cover img,.grid .cover img{object-fit:contain;background:#eef2f6}.shell{padding:16px 12px 32px}}
  `;

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'text') node.textContent = value;
      else if (key === 'class') node.className = value;
      else node.setAttribute(key, value);
    }
    for (const child of children) node.append(child);
    return node;
  }
  const text = (tag, value, className) => el(tag, { text: value, ...(className && { class: className }) });
  const link = (value, href, className) => el('a', { href, text: value, ...(className && { class: className }) });
  const facts = product => el('div', { class: 'facts' }, [
    ...(product.maxGuests ? [text('span', `До ${product.maxGuests} гостей`)] : [text('span', 'Вместимость — уточните у владельца')]),
    ...(product.bedrooms ? [text('span', `${product.bedrooms} ${plural(product.bedrooms, ['спальня', 'спальни', 'спален'])}`)] : []),
    ...(product.beds ? [text('span', `${product.beds} ${plural(product.beds, ['спальное место', 'спальных места', 'спальных мест'])}`)] : []),
  ]);

  function mountGallery({ root, rutubeUrl }) {
    const original = [...root.childNodes];
    const photos = [...root.querySelectorAll("img")].map((image) => ({ src: image.getAttribute("data-original") || image.currentSrc || image.src, alt: image.alt || "Фото дома" }))
      .filter((image) => { try { return ["https:", "http:"].includes(new URL(image.src, location.href).protocol); } catch { return false; } });
    let video = null;
    try {
      const url = new URL(rutubeUrl);
      const id = url.pathname.match(/^\/(?:video|play\/embed)\/([a-f0-9]{32})\/?$/i)?.[1];
      if (url.protocol === "https:" && url.hostname === "rutube.ru" && id) video = `https://rutube.ru/play/embed/${id}/`;
    } catch { /* Optional video; unsupported URLs never become iframe content. */ }
    if (!photos.length && !video) return { destroy() {} };
    const shadow = root.shadowRoot || root.attachShadow({ mode: "open" }); shadow.replaceChildren();
    const style = document.createElement("style"); style.textContent = `
      :host{display:block;min-width:0}*{box-sizing:border-box}[hidden]{display:none!important}
      button{font:inherit;cursor:pointer;padding:10px;border:1px solid #b9c9bd;border-radius:8px;background:white;color:#20342b}
      :focus-visible{outline:3px solid #176348;outline-offset:2px}.viewer{position:relative;background:#f4f6f5;border-radius:10px;overflow:hidden;touch-action:pan-y}
      .photo-button{display:block;width:100%;border:0;background:transparent;padding:0}img{display:block;width:100%;height:auto;max-height:65vh;object-fit:contain}
      iframe{display:block;width:100%;aspect-ratio:16/9;border:0}.navigation{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:8px 0}
      .thumbnails{display:flex;gap:8px;overflow-x:auto;padding:4px}.thumbnails button{padding:2px;min-width:56px;flex:none}.thumbnails img{width:48px;height:64px;object-fit:contain}
      [aria-current=true]{outline:3px solid #176348;outline-offset:-2px}dialog{max-width:96vw;max-height:96vh;padding:8px;border:0;border-radius:8px}dialog::backdrop{background:#000b}dialog img{max-height:85vh;max-width:90vw;width:auto}
    `;
    const viewer = document.createElement("div"); viewer.className = "viewer"; viewer.tabIndex = 0; viewer.setAttribute("aria-label", "Галерея дома");
    const navigation = document.createElement("div"); navigation.className = "navigation";
    const previous = document.createElement("button"); previous.type = "button"; previous.textContent = "←"; previous.setAttribute("aria-label", "Предыдущее фото");
    const next = document.createElement("button"); next.type = "button"; next.textContent = "→"; next.setAttribute("aria-label", "Следующее фото");
    const caption = document.createElement("span"); caption.setAttribute("aria-live", "polite"); navigation.append(previous, caption, next);
    const thumbs = document.createElement("div"); thumbs.className = "thumbnails";
    const modal = document.createElement("dialog"); modal.setAttribute("aria-label", "Увеличенное фото");
    const close = document.createElement("button"); close.type = "button"; close.textContent = "Закрыть фото"; close.addEventListener("click", () => modal.close()); modal.append(close);
    let current = 0; const total = photos.length + Number(Boolean(video));
    function render() {
      viewer.replaceChildren(); caption.textContent = `${current + 1} / ${total}`;
      [...thumbs.children].forEach((thumb, index) => thumb.setAttribute("aria-current", String(index === current)));
      if (current < photos.length) {
        const photo = document.createElement("img"); photo.src = photos[current].src; photo.alt = photos[current].alt;
        const zoom = document.createElement("button"); zoom.type = "button"; zoom.className = "photo-button"; zoom.setAttribute("aria-label", "Увеличить фото");
        zoom.addEventListener("click", () => { modal.querySelector("img")?.remove(); const image = photo.cloneNode(); modal.append(image); modal.showModal(); }); zoom.append(photo); viewer.append(zoom);
      } else {
        const iframe = document.createElement("iframe"); iframe.src = video; iframe.title = "Видео дома на Rutube";
        iframe.allow = "fullscreen; picture-in-picture"; iframe.allowFullscreen = true; iframe.referrerPolicy = "strict-origin-when-cross-origin";
        iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-presentation"); viewer.append(iframe);
      }
    }
    function move(delta) { current = (current + delta + total) % total; render(); }
    previous.addEventListener("click", () => move(-1)); next.addEventListener("click", () => move(1));
    shadow.addEventListener("keydown", (event) => { if (modal.open) return; if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); move(event.key === "ArrowLeft" ? -1 : 1); } });
    let start = null;
    viewer.addEventListener("pointerdown", (event) => { if (event.pointerType === "touch") start = event.clientX; });
    viewer.addEventListener("pointerup", (event) => { if (start !== null && Math.abs(event.clientX - start) > 45) move(event.clientX < start ? 1 : -1); start = null; });
    viewer.addEventListener("pointercancel", () => { start = null; });
    for (let index = 0; index < total; index++) {
      const button = document.createElement("button"); button.type = "button";
      button.setAttribute("aria-label", index < photos.length ? `Фото ${index + 1}` : "Видео Rutube");
      if (index < photos.length) { const thumb = document.createElement("img"); thumb.src = photos[index].src; thumb.alt = ""; thumb.loading = "lazy"; button.append(thumb); }
      else button.textContent = "Видео";
      button.addEventListener("click", () => { current = index; render(); }); thumbs.append(button);
    }
    shadow.append(style, viewer, navigation, thumbs, modal); render();
    return { destroy() { if (modal.open) modal.close(); shadow.replaceChildren(document.createElement("slot")); root.replaceChildren(...original); } };
  }
  function mount({ root, apiOrigin, privacyUrl, pagePath = window.location.pathname, testMode = true }) {
    if (!root || !window.DomKazanCalendar) throw new Error('Модуль поиска не загружен.');
    const origin = new URL(apiOrigin);
    if (origin.protocol !== 'https:') throw new Error('Требуется HTTPS API.');
    const shadow = root.shadowRoot || root.attachShadow({ mode: 'open' });
    shadow.replaceChildren(el('style', { text: css }), text('div', 'Загружаем каталог домов…', 'loading'));
    const abort = new AbortController();
    let widget;
    let media;
    let resuming = false;
    let lastResult = null;
    let alive = true;

    function houseUrl(uid, values = {}) {
      const url = new URL(pagePath, window.location.origin);
      if (uid) url.searchParams.set('house', uid);
      for (const name of ['checkIn', 'checkOut', 'guests', 'amenities', 'sort']) if (values[name]) url.searchParams.set(name, values[name]);
      return url.pathname + url.search;
    }

    async function load() {
      const response = await fetch(new URL('/api/catalog', origin), { signal: abort.signal });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.products)) throw new Error(data.error || 'Каталог временно недоступен.');
      if (!alive) return;
      const products = data.products.filter(product => /^\d{12}$/.test(product.productUid) && product.slug === `tilda-${product.productUid}`);
      const bySlug = new Map(products.map(product => [product.slug, product]));
      const query = new URLSearchParams(window.location.search);
      const houseUid = query.get('house');
      const selected = products.find(product => product.productUid === houseUid);
      const values = Object.fromEntries(['checkIn', 'checkOut', 'guests', 'amenities', 'sort'].map(name => [name, query.get(name) || '']));
      const style = shadow.querySelector('style');
      const shell = el('div', { class: 'shell' });
      shadow.replaceChildren(style, shell);
      const brand = link('DOM', houseUrl(null), 'brand'); brand.append(text('span', 'KAZAN'), text('small', 'Казань и рядом', 'city'));
      shell.append(el('div', { class: 'top' }, [brand, link('+7 905 310-66-05', 'tel:+79053106605', 'top-contact')]));
      if (houseUid && !selected) {
        shell.append(link('← Все дома', houseUrl(null), 'back'), text('h1', 'Дом не найден'), text('p', 'Возможно, он был удалён из каталога. Выберите другой вариант.', 'subtitle'));
        return;
      }
      if (selected) shell.append(link('← К результатам поиска', houseUrl(null, values), 'back'));
      const intro = el('div', { class: 'intro' }, selected ? [text('h1', selected.name), facts(selected)] : []);
      shell.append(intro);
      const search = el('div');
      const searchPanel = el('div', { class: 'search' }, selected ? [text('h2', 'Проверить даты и стоимость'), search] : [search]);
      const notice = el('div', { class: 'test-note' }, [text('b', 'ТЕСТОВЫЙ СТЕНД'),
        text('span', 'Фото и описания — из каталога Tilda. Занятость и расчёт тестовые. Бронирование и оплата согласуются с владельцем.')]);
      if (!selected) shell.append(searchPanel, notice);
      const filter = { amenities: values.amenities.split(',').filter(key => Object.hasOwn(searchLabels, key)),
        sort: ['price', 'price-desc'].includes(values.sort) ? values.sort : 'default' };
      const filterState = () => ({ amenities: [...filter.amenities].sort() });
      const paramsWithFilters = current => ({ ...current, amenities: filter.amenities.join(','), sort: filter.sort });
      const cards = [];
      const cardLinks = [];
      let list;
      let counter;
      let empty;
      let breakdown;

      if (selected) {
        document.title = `${selected.name} — DomKazan, тест`;
        const galleryRoot = el('div', { class:'gallery' }, selected.images.map(src => el('img', { src, alt:selected.name, loading:'lazy' })));
        shell.append(galleryRoot); media = mountGallery({root:galleryRoot, rutubeUrl:selected.rutubeUrl});
        const info = el('div', { class: 'house-copy' }, [text('h2', 'Описание'), text('p', selected.description)]);
        const contacts = el('div', { class: 'contacts' }, [link('Позвонить', 'tel:+79053106605'),
          link('Telegram ↗', 'https://t.me/viteek_b'), link('WhatsApp ↗', 'https://wa.me/message/OZ7WM2IJUPIXM1')]);
        for (const item of contacts.querySelectorAll('a[href^="https:"]')) { item.target = '_blank'; item.rel = 'noopener noreferrer'; }
        info.append(contacts, text('p', 'Свяжитесь с владельцем, чтобы уточнить условия. На стенде отправляйте только тестовые заявки.', 'contact-note'));
        const price = text('p', 'Выберите даты для расчёта', 'price');
        const action = el('div');
        breakdown = text('p', '', 'breakdown');
        const quote = el('div', { class: 'booking-quote' }, [price, breakdown, action]);
        cards.push({ slug: selected.slug, element: quote, priceElement: price, actionElement: action });
        const booking = el('aside', { class: 'booking' }, [searchPanel, quote, notice]);
        shell.append(el('div', { class: 'house-layout' }, [info, booking]));
      } else {
        const sort = el('select', {'aria-label':'Сортировать'}, [['default', 'По умолчанию'], ['price', 'Сначала дешевле'], ['price-desc', 'Сначала дороже']].map(([value, label]) => el('option', { value, text: label })));
        sort.value = filter.sort;
        const sortLabel = text('label', 'Сортировать', 'sort-control'); sortLabel.append(sort);
        sort.addEventListener('change', () => {
          filter.sort = sort.value;
          if (lastResult) applyResults(lastResult.houses, lastResult.snapshot, false);
        });
        counter = text('span', `${products.length} ${plural(products.length, ['дом', 'дома', 'домов'])} в каталоге`, 'count');
        const toolbar = el('div', { class:'toolbar', tabindex:'-1' }, [el('h2', {}, [counter]), sortLabel]);
        shell.append(toolbar);
        list = el('div', { class: 'cards grid', 'aria-label': 'Каталог домов' });
        for (const product of products) {
          const href = houseUrl(product.productUid, values);
          const cover = el('a', { href, class: 'cover', 'aria-label': `Подробнее: ${product.name}` });
          if (product.images[0]) cover.append(el('img', { src: product.images[0], alt: product.name, loading: 'lazy', width: '600', height: '440' }));
          cover.append(text('span', `${product.images.length} фото`, 'photo-count'));
          const titleLink = link(product.name, href);
          const details = link('Подробнее о доме →', href, 'details-link');
          const excerpt = product.facts.slice(0,180);
          const info = el('div', { class: 'info' }, [el('h2', {}, [titleLink]), facts(product), text('p', excerpt + (product.facts.length > 180 ? '…' : ''), 'description-preview'), details]);
          const base = Math.min(...Object.values(product.publicBaseRates).filter(value => Number(value) > 0));
          const price = text('p', Number.isFinite(base) ? `от ${rub(base)} ₽` : 'По запросу', 'price');
          price.append(text('small', 'за ночь · выберите даты'));
          const actions = el('div');
          const card = el('article', { class: 'card', 'data-domkazan-house': product.slug }, [cover, info, el('div', { class: 'price-area' }, [price, actions])]);
          cards.push({ slug: product.slug, element: card, priceElement: price, actionElement: actions });
          cardLinks.push({ product, nodes: [cover, titleLink, details] }); list.append(card);
          for (const node of [cover,titleLink,details]) node.addEventListener('click', () => {
            try { sessionStorage.setItem('domkazan.catalog.return.v1', JSON.stringify({url:houseUrl(null, paramsWithFilters(widget.values())), y:window.scrollY})); } catch { /* Optional position restoration. */ }
          });
        }
        empty = el('div', { class: 'empty', hidden: '' }, [text('h2', 'Подходящих домов не нашлось'), text('p', 'Попробуйте другие даты, уменьшите число гостей или снимите часть фильтров.')]);
        shell.append(list, empty, text('p', 'Вы выбираете дом на нашем сайте. Детали заезда и оплату согласуем лично.', 'footer-note'));
      }

      function applyResults(houses, snapshot, scroll = true) {
        const params = paramsWithFilters({checkIn:snapshot.checkIn, checkOut:snapshot.checkOut, guests:snapshot.guests});
        window.history.replaceState(window.history.state, '', houseUrl(selected?.productUid, params));
        for (const {product,nodes} of cardLinks) for (const node of nodes) node.href = houseUrl(product.productUid, params);
        if (counter) counter.textContent = `Найдено домов: ${houses.length}`;
        if (empty) empty.hidden = houses.length > 0;
        if (list) {
          const sorted = [...houses].sort((a,b) => filter.sort === 'default' ? products.indexOf(bySlug.get(a.slug)) - products.indexOf(bySlug.get(b.slug)) :
            (Number(a.quote.total)-Number(b.quote.total)) * (filter.sort === 'price-desc' ? -1 : 1));
          for (const [index, house] of sorted.entries()) cards.find(card => card.slug === house.slug).element.style.order = String(index);
          if (scroll && !resuming) shadow.querySelector('.toolbar').scrollIntoView?.({behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
          if (resuming) {
            try { const saved = JSON.parse(sessionStorage.getItem('domkazan.catalog.return.v1')); if (saved?.url === houseUrl(null,params) && Number.isFinite(saved.y)) window.scrollTo?.({top:Math.max(0,saved.y),behavior:'instant'}); } catch { /* Optional. */ }
          }
        }
        if (breakdown && houses[0]) {
          const quote=houses[0].quote;
          breakdown.textContent=quote.accommodationTotal?`Проживание ${rub(quote.accommodationTotal)} ₽ · дополнительные гости ${rub(quote.extraGuestTotal)} ₽ · сбор ${rub(quote.serviceFee)} ₽. Включено в итог.`:'Стоимость рассчитана сервером по тарифам календаря.';
        }
        lastResult={houses,snapshot}; resuming=false;
      }
      widget = window.DomKazanCalendar.mount({ root: search, apiUrl: new URL('/api/availability', origin).href,
        privacyUrl: privacyUrl || new URL('/test-policy', origin).href, cards, initialValues: values, testMode,
        houseSlug:selected?.slug, showCount:!selected,
        calendarUrl:selected?new URL(`/api/house-calendar?house=${selected.slug}`,origin).href:undefined,
        resultsUrl:()=>houseUrl(null,paramsWithFilters(widget.values())),
        ownerContacts:{phone:'tel:+79053106605',telegram:'https://t.me/viteek_b',whatsapp:'https://wa.me/message/OZ7WM2IJUPIXM1'},
        getFilters:()=>({amenities:filter.amenities.join(',')}),
        renderPrice(target, house) {
          target.replaceChildren(document.createTextNode(`${rub(house.quote.total)} ₽ `), text('small', `за ${house.quote.nights} ноч.`));
        },
        getViewState: filterState,
        transformHouses(houses) {
          return houses.filter(house => {
            const product = bySlug.get(house.slug);
            return product && (!selected || selected.slug === house.slug);
          });
        },
        onInvalidate(currentValues) {
          lastResult=null;
          if (counter) counter.textContent = `${products.length} ${plural(products.length, ['дом', 'дома', 'домов'])} в каталоге`;
          if (empty) empty.hidden = true;
          if (breakdown) breakdown.textContent = '';
          for (const { product, nodes } of cardLinks) for (const node of nodes) node.href = houseUrl(product.productUid, paramsWithFilters(currentValues));
        },
        onResults:applyResults,
      });
      if (!selected) {
        const chips = el('fieldset',{class:'search-amenities'},[el('legend',{text:'Удобства',class:'sr-only'})]);
        for (const [key,label] of Object.entries(searchLabels)) {
          const input=el('input',{type:'checkbox',value:key}); input.checked=filter.amenities.includes(key);
          chips.append(el('label',{},[input,text('span',label)]));
          input.addEventListener('change',()=>{filter.amenities=[...chips.querySelectorAll('input:checked')].map(item=>item.value);});
        }
        search.shadowRoot.querySelector('form').append(chips);
      }
      if (selected) search.style.cssText = '--dk-accent:#218df1';
      if (values.checkIn && values.checkOut) {resuming=true;widget.search();}
      root.dispatchEvent(new CustomEvent('domkazan:ready', { bubbles: true, detail: { count: products.length } }));
    }
    load().catch(error => {
      if (!alive || error.name === 'AbortError') return;
      shadow.append(text('p', error.message || 'Не удалось загрузить каталог.', 'error'));
      root.dispatchEvent(new CustomEvent('domkazan:error', { bubbles: true }));
    });
    function pageShown(event){if(event.persisted&&widget){resuming=true;widget.search();}}
    window.addEventListener('pageshow',pageShown);
    return { destroy() { alive = false; abort.abort(); widget?.destroy(); media?.destroy(); window.removeEventListener('pageshow',pageShown); shadow.replaceChildren(); } };
  }
  window.DomKazanCatalog = { mount };
})();
