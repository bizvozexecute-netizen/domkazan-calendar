/* Tilda remains the content editor. Calendar quotes and requests come from DomKazan. */
(() => {
  const labels = { pool: 'Бассейн', sauna: 'Баня / сауна', billiards: 'Бильярд', jacuzzi: 'Джакузи', tub: 'Чан / фурако', bbq: 'Мангал', wifi: 'Wi-Fi' };
  const rub = value => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(Number(value));
  const plural = (value, forms) => forms[value % 100 >= 11 && value % 100 <= 14 ? 2 : value % 10 === 1 ? 0 : value % 10 >= 2 && value % 10 <= 4 ? 1 : 2];
  const css = `
    :host{display:block;--dk-accent:#218df1;color:#192a3a;font:16px/1.5 Arial,sans-serif;background:#f6f8fb}
    *{box-sizing:border-box} [hidden]{display:none!important} a{color:inherit;text-decoration:none} button,input,select{font:inherit} button,a,input,select,summary{-webkit-tap-highlight-color:transparent} button,a{touch-action:manipulation} button{cursor:pointer} button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible{outline:3px solid #9cd0ff;outline-offset:3px}
    .shell{max-width:1200px;margin:auto;padding:36px 24px 64px}.top{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:32px}.brand{font-size:23px;font-weight:800;letter-spacing:-1px}.brand span{color:var(--dk-accent)}.city{margin-left:16px;color:#7b8795;font-size:14px;font-weight:400;letter-spacing:0}.top-contact{font-size:15px;font-weight:700}.intro{margin:0 0 24px}.eyebrow{font-size:12px;letter-spacing:.12em;color:#637b90;text-transform:uppercase;font-weight:700}h1{margin:8px 0 10px;font-size:clamp(28px,3.7vw,42px);line-height:1.16;letter-spacing:-1px}.subtitle{margin:0;color:#708091;font-size:16px}.search{padding:22px 24px;border:1px solid #e6ecf1;border-radius:16px;background:#fff;box-shadow:0 8px 24px #233d5810}.test-note{display:flex;align-items:baseline;gap:10px;margin:15px 0 28px;color:#7a8795;font-size:12px}.test-note b{flex-shrink:0;color:#486c94;background:#eaf2fb;border-radius:5px;padding:3px 7px;font-size:11px}.toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:26px 0 16px}.count{font-size:20px;font-weight:700}.view{display:flex;border:1px solid #e1e7ee;border-radius:9px;padding:3px;background:#fff}.view button{border:0;background:transparent;border-radius:6px;padding:7px 12px;color:#728193;font-size:13px}.view button[aria-pressed=true]{background:#eaf3ff;color:#1769b6;font-weight:700}.filters{border:1px solid #e2e8ef;background:#fff;border-radius:12px;margin-bottom:20px;padding:16px 20px}.filters summary{font-size:14px;font-weight:700;cursor:pointer}.filter-fields{display:grid;grid-template-columns:2fr 1fr 1fr 1.4fr;gap:14px;margin-top:16px}.filter-fields label{display:grid;gap:5px;color:#768494;font-size:12px}.filter-fields input,.filter-fields select{width:100%;min-width:0;height:42px;border:1px solid #e1e6ec;border-radius:7px;padding:8px 10px;background:#fff;color:#23384c;font-size:14px}.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}.chip{display:flex;align-items:center;gap:7px;border:1px solid #e1e8f0;border-radius:7px;padding:7px 11px;font-size:13px;color:#536579;cursor:pointer}.chip:has(input:checked){background:#edf5ff;border-color:#85baff;color:#1769b6}.chip input{accent-color:var(--dk-accent)}.reset{border:0;background:transparent;color:#2486df;font-size:13px;padding:8px}.cards{display:grid;gap:18px}.card{display:grid;grid-template-columns:300px minmax(0,1fr) 225px;background:#fff;border:1px solid #e9edf2;border-radius:15px;overflow:hidden;box-shadow:0 5px 18px #233d5807}.cover{display:block;min-height:235px;background:#e9eef4;position:relative}.cover img{width:100%;height:100%;min-height:235px;max-height:280px;object-fit:cover;display:block;transition:transform .2s}.cover:hover img{transform:scale(1.025)}.photo-count{position:absolute;bottom:12px;left:14px;border-radius:5px;padding:3px 8px;background:#14222eaa;color:white;font-size:11px}.info{padding:26px 25px}.info h2{margin:0 0 14px;font-size:23px;line-height:1.2;letter-spacing:-.4px}.info h2 a:hover{color:#218df1}.facts{display:flex;gap:8px 16px;flex-wrap:wrap;color:#5b6b7d;font-size:13px;margin-bottom:16px}.facts span{white-space:nowrap}.amenities{display:flex;gap:6px;flex-wrap:wrap;list-style:none;padding:0;margin:0 0 19px}.amenities li{background:#f3f6f9;border-radius:5px;padding:4px 8px;font-size:11px;color:#66788a}.details-link{font-size:14px;font-weight:700;color:#2288e6}.price-area{padding:26px 22px;border-left:1px solid #edf0f4;display:flex;flex-direction:column;justify-content:space-between;gap:16px}.price{margin:0;font-size:24px;font-weight:700;letter-spacing:-.5px;line-height:1.2;color:#172c40}.price small{display:block;font-size:12px;font-weight:400;letter-spacing:0;color:#7d8b9b;margin-top:7px}.price-area [data-domkazan-action-for] button{width:100%;font-size:13px!important;font-weight:700!important;margin:0!important;min-height:44px}.empty{padding:48px 20px;text-align:center;background:white;border:1px dashed #d5e0eb;border-radius:14px}.empty h2{margin:0 0 8px;font-size:22px}.empty p{color:#758496;margin:0 0 18px}.cards.grid{grid-template-columns:repeat(3,minmax(0,1fr))}.grid .card{grid-template-columns:1fr}.grid .cover{min-height:210px}.grid .cover img{height:210px;min-height:210px}.grid .info{padding:20px}.grid .price-area{border-left:0;border-top:1px solid #edf0f4;padding:18px 20px}.grid .info h2{font-size:21px}.back{display:inline-flex;align-items:center;gap:8px;color:#66809a;font-size:14px;margin-bottom:18px}.gallery{display:grid;grid-template-columns:minmax(0,1fr) 165px;gap:10px;margin:26px 0}.main-photo{width:100%;height:480px;object-fit:cover;border-radius:16px;background:#e7edf4}.thumbs{display:grid;grid-template-columns:1fr 1fr;gap:8px;align-content:start;max-height:480px;overflow:auto}.thumbs button{padding:0;border:2px solid transparent;border-radius:8px;background:none;overflow:hidden}.thumbs button[aria-pressed=true]{border-color:var(--dk-accent)}.thumbs img{display:block;width:100%;height:77px;object-fit:cover}.house-layout{display:grid;grid-template-columns:minmax(0,1fr) 400px;gap:32px;align-items:start}.house-copy{background:white;border:1px solid #e5ebf1;border-radius:16px;padding:30px}.house-copy h2{margin:0 0 18px;font-size:23px}.house-copy p{white-space:pre-line;color:#5f7183;margin:0;line-height:1.9}.house-copy .amenities{margin-bottom:24px}.booking{position:sticky;top:20px}.booking .search{padding:22px}.booking h2{margin:0 0 18px;font-size:21px}.booking-quote{background:white;padding:0 22px 22px;border:1px solid #e6ecf1;border-top:0;border-radius:0 0 16px 16px;margin-top:-12px}.breakdown{color:#7b8896;font-size:12px;margin-top:12px}.contacts{display:flex;flex-wrap:wrap;gap:8px;margin-top:20px}.contacts a{padding:10px 13px;border:1px solid #dce6ef;border-radius:8px;font-size:13px;font-weight:700;color:#2884d5}.contacts a:hover{background:#eff6ff}.contact-note{font-size:12px;color:#7e8b98;margin:13px 0 0}.footer-note{font-size:13px;color:#7e8c9b;text-align:center;margin:36px 0 0}.error{background:#fff0ed;border:1px solid #f6d2c8;padding:18px;border-radius:12px;color:#8d422c}.loading{padding:60px;text-align:center;color:#718297}
    @media(max-width:1050px){.card{grid-template-columns:245px minmax(0,1fr) 200px}.info{padding:22px 18px}.price-area{padding:22px 18px}.cards.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.house-layout{grid-template-columns:minmax(0,1fr) 350px}.main-photo{height:400px}.filter-fields{grid-template-columns:1fr 1fr}}
    @media(max-width:760px){.shell{padding:24px 16px 40px}.top{margin-bottom:26px}.brand{font-size:21px}.city{display:none}.top-contact{font-size:12px}.intro{margin-bottom:20px}h1{font-size:30px;letter-spacing:-.6px}.subtitle{font-size:14px}.search{padding:18px 16px}.test-note{align-items:start;margin-bottom:20px}.filters{padding:14px}.filter-fields{gap:10px}.filter-fields label:first-child{grid-column:1/-1}.chip{font-size:12px;padding:6px 8px}.toolbar{margin-top:20px}.count{font-size:18px}.card,.cards.grid .card{grid-template-columns:1fr}.cards.grid{grid-template-columns:1fr}.cover,.cover img,.grid .cover,.grid .cover img{height:220px;min-height:220px;max-height:none}.info{padding:20px 20px 14px}.info h2{font-size:23px;margin-bottom:12px}.amenities{margin-bottom:16px}.price-area{border-left:0;border-top:1px solid #edf0f4;padding:18px 20px;display:grid;grid-template-columns:1fr 1fr;align-items:center}.price{font-size:22px}.price-area [data-domkazan-action-for] button{font-size:12px!important;padding:12px!important}.view{display:none}.house-layout{grid-template-columns:1fr;gap:20px}.booking{position:static;grid-row:1}.gallery{grid-template-columns:1fr;margin:20px 0}.main-photo{height:280px;border-radius:12px}.thumbs{grid-template-columns:repeat(6,90px);overflow:auto;max-height:90px}.thumbs img{height:65px}.house-copy{padding:22px}.house-copy h2{font-size:21px}.booking .search{padding:20px}.booking-quote{display:block}.contacts a{flex:1;text-align:center}.empty{padding:32px 20px}}
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
  const amenities = product => el('ul', { class: 'amenities' }, product.amenities.map(key => text('li', labels[key] || key)));
  const facts = product => el('div', { class: 'facts' }, [
    ...(product.maxGuests ? [text('span', `До ${product.maxGuests} гостей`)] : [text('span', 'Вместимость — уточните у владельца')]),
    ...(product.bedrooms ? [text('span', `${product.bedrooms} ${plural(product.bedrooms, ['спальня', 'спальни', 'спален'])}`)] : []),
    ...(product.beds ? [text('span', `${product.beds} ${plural(product.beds, ['спальное место', 'спальных места', 'спальных мест'])}`)] : []),
  ]);

  function mount({ root, apiOrigin, privacyUrl, pagePath = window.location.pathname, testMode = true }) {
    if (!root || !window.DomKazanCalendar) throw new Error('Модуль поиска не загружен.');
    const origin = new URL(apiOrigin);
    if (origin.protocol !== 'https:') throw new Error('Требуется HTTPS API.');
    const shadow = root.shadowRoot || root.attachShadow({ mode: 'open' });
    shadow.replaceChildren(el('style', { text: css }), text('div', 'Загружаем каталог домов…', 'loading'));
    const abort = new AbortController();
    let widget;
    let alive = true;

    function houseUrl(uid, values = {}) {
      const url = new URL(pagePath, window.location.origin);
      if (uid) url.searchParams.set('house', uid);
      for (const name of ['checkIn', 'checkOut', 'guests']) if (values[name]) url.searchParams.set(name, values[name]);
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
      const values = Object.fromEntries(['checkIn', 'checkOut', 'guests'].map(name => [name, query.get(name) || '']));
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
      const intro = el('div', { class: 'intro' }, [text('span', selected ? 'Дом в Казани' : 'Коттеджи посуточно в Казани', 'eyebrow'),
        text('h1', selected ? selected.name : 'Найдите дом для своих планов'),
        selected ? facts(selected) : text('p', 'Выберите даты, гостей и то, что сделает отдых вашим.', 'subtitle')]);
      shell.append(intro);
      const search = el('div');
      const searchPanel = el('div', { class: 'search' }, selected ? [text('h2', 'Проверить даты и стоимость'), search] : [search]);
      const notice = el('div', { class: 'test-note' }, [text('b', 'ТЕСТОВЫЙ СТЕНД'),
        text('span', 'Фото и описания — из каталога Tilda. Занятость и расчёт тестовые. Бронирование и оплата согласуются с владельцем.')]);
      if (!selected) shell.append(searchPanel, notice);
      const filter = { query: '', budget: '', bedrooms: '', amenities: [], sort: 'default' };
      const filterState = () => ({ ...filter, amenities: [...filter.amenities] });
      const cards = [];
      const cardLinks = [];
      let list;
      let counter;
      let empty;
      let breakdown;

      if (selected) {
        document.title = `${selected.name} — DomKazan, тест`;
        const first = selected.images[0];
        const main = el('img', { src: first || '', alt: selected.name, class: 'main-photo', width: '960', height: '640' });
        const thumbs = el('div', { class: 'thumbs', 'aria-label': 'Фотографии дома' });
        selected.images.forEach((src, index) => {
          const button = el('button', { type: 'button', 'aria-label': `Фото ${index + 1}`, 'aria-pressed': index === 0 ? 'true' : 'false' },
            [el('img', { src, alt: '', loading: 'lazy', width: '120', height: '90' })]);
          button.addEventListener('click', () => {
            main.src = src;
            for (const item of thumbs.children) item.setAttribute('aria-pressed', item === button ? 'true' : 'false');
          });
          thumbs.append(button);
        });
        if (first) shell.append(el('div', { class: 'gallery' }, [main, thumbs]));
        const info = el('div', { class: 'house-copy' }, [text('h2', 'Об этом доме'), amenities(selected), text('p', selected.facts)]);
        const conditions = selected.description.split('\n').filter(line => !selected.facts.includes(line) &&
          !/^[—–-]$|^(Будни|Пятница|Суббота|Воскресенье)\s*[-–—:]/i.test(line)).join('\n');
        if (conditions) info.append(el('hr'), text('h2', 'Условия проживания'), text('p', conditions));
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
        const filters = el('details', { class: 'filters', open: '' }, [text('summary', 'Фильтры и сортировка')]);
        const fields = el('div', { class: 'filter-fields' });
        for (const [key, label, type, placeholder] of [['query', 'Название дома', 'search', 'Например, Казанка'], ['budget', 'Бюджет за весь заезд, ₽', 'number', 'Любой']]) {
          const input = el('input', { type, placeholder, ...(type === 'number' && { min: '0', step: '1000' }) });
          const labelNode = text('label', label); labelNode.append(input); fields.append(labelNode);
          input.addEventListener('input', () => { filter[key] = input.value; widget?.invalidate(); });
        }
        const bedrooms = el('select', {}, [['', 'Любое'], ['2', 'От 2 спален'], ['3', 'От 3 спален'], ['4', 'От 4 спален'], ['5', 'От 5 спален']].map(([value, label]) => el('option', { value, text: label })));
        const bedroomLabel = text('label', 'Количество спален'); bedroomLabel.append(bedrooms); fields.append(bedroomLabel);
        bedrooms.addEventListener('change', () => { filter.bedrooms = bedrooms.value; widget?.invalidate(); });
        const sort = el('select', {}, [['default', 'Как в каталоге'], ['price', 'Сначала дешевле'], ['price-desc', 'Сначала дороже'], ['capacity', 'По вместимости']].map(([value, label]) => el('option', { value, text: label })));
        const sortLabel = text('label', 'Порядок показа'); sortLabel.append(sort); fields.append(sortLabel);
        sort.addEventListener('change', () => { filter.sort = sort.value; widget?.invalidate(); });
        const chips = el('div', { class: 'chips' });
        for (const [key, label] of Object.entries(labels)) {
          if (!products.some(product => product.amenities.includes(key))) continue;
          const input = el('input', { type: 'checkbox', value: key });
          chips.append(el('label', { class: 'chip' }, [input, text('span', label)]));
          input.addEventListener('change', () => { filter.amenities = [...chips.querySelectorAll('input:checked')].map(item => item.value); widget?.invalidate(); });
        }
        const reset = text('button', 'Сбросить фильтры', 'reset'); reset.type = 'button';
        reset.addEventListener('click', () => {
          for (const input of fields.querySelectorAll('input')) input.value = '';
          bedrooms.value = ''; sort.value = 'default';
          for (const input of chips.querySelectorAll('input')) input.checked = false;
          Object.assign(filter, { query: '', budget: '', bedrooms: '', amenities: [], sort: 'default' });
          widget.invalidate();
        });
        chips.append(reset); filters.append(fields, chips); shell.append(filters);
        counter = text('span', `${products.length} ${plural(products.length, ['дом', 'дома', 'домов'])} в каталоге`, 'count');
        const views = el('div', { class: 'view', 'aria-label': 'Вид каталога' });
        for (const [value, title] of [['list', 'Списком'], ['grid', 'Плиткой']]) {
          const button = el('button', { type: 'button', text: title, 'aria-pressed': value === 'list' ? 'true' : 'false' });
          button.addEventListener('click', () => { list.classList.toggle('grid', value === 'grid'); for (const item of views.children) item.setAttribute('aria-pressed', item === button ? 'true' : 'false'); });
          views.append(button);
        }
        shell.append(el('div', { class: 'toolbar' }, [counter, views]));
        list = el('div', { class: 'cards', 'aria-label': 'Каталог домов' });
        for (const product of products) {
          const href = houseUrl(product.productUid, values);
          const cover = el('a', { href, target: '_blank', rel: 'noopener', class: 'cover', 'aria-label': `Подробнее: ${product.name}` });
          if (product.images[0]) cover.append(el('img', { src: product.images[0], alt: product.name, loading: 'lazy', width: '600', height: '440' }));
          cover.append(text('span', `${product.images.length} фото`, 'photo-count'));
          const titleLink = link(product.name, href); titleLink.target = '_blank'; titleLink.rel = 'noopener';
          const details = link('Подробнее о доме →', href, 'details-link'); details.target = '_blank'; details.rel = 'noopener';
          const info = el('div', { class: 'info' }, [el('h2', {}, [titleLink]), facts(product), amenities(product), details]);
          const base = Math.min(...Object.values(product.publicBaseRates).filter(value => Number(value) > 0));
          const price = text('p', Number.isFinite(base) ? `от ${rub(base)} ₽` : 'По запросу', 'price');
          price.append(text('small', 'за ночь · выберите даты'));
          const actions = el('div');
          const card = el('article', { class: 'card', 'data-domkazan-house': product.slug }, [cover, info, el('div', { class: 'price-area' }, [price, actions])]);
          cards.push({ slug: product.slug, element: card, priceElement: price, actionElement: actions });
          cardLinks.push({ product, nodes: [cover, titleLink, details] }); list.append(card);
        }
        empty = el('div', { class: 'empty', hidden: '' }, [text('h2', 'Подходящих домов не нашлось'), text('p', 'Попробуйте другие даты, уменьшите число гостей или снимите часть фильтров.')]);
        shell.append(list, empty, text('p', 'Вы выбираете дом на нашем сайте. Детали заезда и оплату согласуем лично.', 'footer-note'));
      }

      widget = window.DomKazanCalendar.mount({ root: search, apiUrl: new URL('/api/availability', origin).href,
        privacyUrl: privacyUrl || new URL('/test-policy', origin).href, cards, initialValues: values, testMode,
        renderPrice(target, house) {
          target.replaceChildren(document.createTextNode(`${rub(house.quote.total)} ₽ `), text('small', `за ${house.quote.nights} ноч.`));
        },
        getViewState: filterState,
        transformHouses(houses) {
          return houses.filter(house => {
            const product = bySlug.get(house.slug);
            return product && (!selected || selected.slug === house.slug) &&
              product.name.toLocaleLowerCase('ru').includes(filter.query.trim().toLocaleLowerCase('ru')) &&
              (!filter.bedrooms || (house.bedrooms ?? product.bedrooms ?? 0) >= Number(filter.bedrooms)) &&
              (!filter.budget || Number(house.quote.total) <= Number(filter.budget)) &&
              filter.amenities.every(key => (house.amenities?.length ? house.amenities : product.amenities).includes(key));
          });
        },
        onInvalidate(currentValues) {
          if (counter) counter.textContent = `${products.length} ${plural(products.length, ['дом', 'дома', 'домов'])} в каталоге`;
          if (empty) empty.hidden = true;
          if (breakdown) breakdown.textContent = '';
          for (const { product, nodes } of cardLinks) for (const node of nodes) node.href = houseUrl(product.productUid, currentValues);
        },
        onResults(houses, snapshot) {
          const params = { checkIn: snapshot.checkIn, checkOut: snapshot.checkOut, guests: snapshot.guests };
          window.history.replaceState(null, '', houseUrl(selected?.productUid, params));
          for (const { product, nodes } of cardLinks) for (const node of nodes) node.href = houseUrl(product.productUid, params);
          if (counter) counter.textContent = `Найдено домов: ${houses.length}`;
          if (empty) empty.hidden = houses.length > 0;
          if (list) {
            const sorted = [...houses].sort((a, b) => filter.sort === 'default' ? products.indexOf(bySlug.get(a.slug)) - products.indexOf(bySlug.get(b.slug)) : filter.sort === 'capacity' ? b.maxGuests - a.maxGuests :
              (Number(a.quote.total) - Number(b.quote.total)) * (filter.sort === 'price-desc' ? -1 : 1));
            for (const house of sorted) list.append(cards.find(card => card.slug === house.slug).element);
          }
          if (breakdown && houses[0]) {
            const quote = houses[0].quote;
            breakdown.textContent = quote.accommodationTotal ? `Проживание ${rub(quote.accommodationTotal)} ₽ · дополнительные гости ${rub(quote.extraGuestTotal)} ₽ · сбор ${rub(quote.serviceFee)} ₽. Включено в итог.` : 'Расчёт по тарифам календаря. Дополнительные услуги согласуются с владельцем.';
          }
        },
      });
      if (selected) search.style.cssText = '--dk-accent:#218df1';
      if (values.checkIn && values.checkOut) widget.search();
      root.dispatchEvent(new CustomEvent('domkazan:ready', { bubbles: true, detail: { count: products.length } }));
    }
    load().catch(error => {
      if (!alive || error.name === 'AbortError') return;
      shadow.append(text('p', error.message || 'Не удалось загрузить каталог.', 'error'));
      root.dispatchEvent(new CustomEvent('domkazan:error', { bubbles: true }));
    });
    return { destroy() { alive = false; abort.abort(); widget?.destroy(); shadow.replaceChildren(); } };
  }
  window.DomKazanCatalog = { mount };
})();
