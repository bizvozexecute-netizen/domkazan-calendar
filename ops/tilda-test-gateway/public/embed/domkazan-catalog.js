/* Tilda remains the content editor. Calendar quotes and requests come from DomKazan. */
(() => {
  const searchLabels = { pool: 'Бассейн', sauna: 'Баня / сауна', billiards: 'Бильярд' };
  const rub = value => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(Number(value));
  const plural = (value, forms) => forms[value % 100 >= 11 && value % 100 <= 14 ? 2 : value % 10 === 1 ? 0 : value % 10 >= 2 && value % 10 <= 4 ? 1 : 2];
  const css = `
    :host{display:block;--dk-accent:#176bdf;--dk-accent-hover:#1054b7;--dk-ink:#172b42;--dk-muted:#586b80;--dk-line:#e0e7ef;color:var(--dk-ink);font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f5f7fa;-webkit-font-smoothing:antialiased}
    *{box-sizing:border-box}[hidden]{display:none!important}a{color:inherit;text-decoration:none}button,input,select{font:inherit}button,a,input,select,summary{-webkit-tap-highlight-color:transparent}button,a{touch-action:manipulation}button{cursor:pointer}button:disabled,select:disabled{cursor:default}button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible{outline:3px solid #176bdf;outline-offset:4px}
    .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0}
    .shell{max-width:1248px;margin:auto;padding:32px 32px 56px}.top{display:flex;align-items:center;justify-content:space-between;gap:16px;padding-bottom:25px;margin-bottom:28px;border-bottom:1px solid var(--dk-line)}.brand{display:inline-flex;align-items:baseline;flex-wrap:wrap;font-size:23px;line-height:1.1;font-weight:850;letter-spacing:-1.1px}.brand span{color:var(--dk-accent)}.city{margin-left:18px;color:var(--dk-muted);font-size:13px;font-weight:400;letter-spacing:0}.top-contact{display:inline-flex;align-items:center;gap:8px;min-height:42px;border:1px solid var(--dk-line);background:#fff;border-radius:100px;padding:9px 15px;font-size:14px;font-weight:650;white-space:nowrap}.top-contact:hover{border-color:#a9c6ed;color:var(--dk-accent)}
    .intro{margin:0 0 22px}.intro:empty{display:none}h1{margin:0 0 14px;font-size:clamp(28px,3.5vw,40px);line-height:1.15;letter-spacing:-1px;font-weight:750}.subtitle{margin:0;color:var(--dk-muted)}.search{padding:24px;border:1px solid var(--dk-line);border-radius:20px;background:#fff;box-shadow:0 8px 30px #243f6210}.test-note{display:flex;align-items:baseline;gap:10px;margin:14px 4px 25px;color:#637386;font-size:11px;line-height:1.5}.test-note b{flex-shrink:0;color:#536a82;background:#e8edf3;border-radius:5px;padding:3px 7px;font-size:10px;letter-spacing:.03em;font-weight:650}
    .toolbar{display:flex;align-items:center;justify-content:space-between;gap:20px;margin:30px 0 20px;scroll-margin-top:20px}.toolbar h2{margin:0}.count{font-size:23px;line-height:1.25;letter-spacing:-.5px;font-weight:700}.results-context{color:var(--dk-muted);font-size:13px;margin:6px 0 0}.sort-control{display:flex;align-items:center;gap:10px;font-size:13px;color:var(--dk-muted)}.sort-control select{min-height:44px;padding:9px 30px 9px 12px;border:1px solid var(--dk-line);border-radius:10px;background:#fff;color:var(--dk-ink);max-width:100%}.sort-control select:disabled{background:#eef2f6;color:#6b7787}.cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px;align-items:stretch}
    .card{min-width:0;display:flex;flex-direction:column;background:#fff;border:1px solid var(--dk-line);border-radius:18px;overflow:hidden;box-shadow:0 3px 12px #243f6205;transition:box-shadow .2s,border-color .2s}.card:focus-within{border-color:#a1c1ec}.cover{display:block;aspect-ratio:16/10;background:#eaf0f5;position:relative;overflow:hidden}.cover img{display:block;width:100%;height:100%;object-fit:cover;transition:transform .35s}.photo-count{position:absolute;bottom:12px;right:12px;display:flex;align-items:center;gap:5px;border:1px solid #ffffff38;border-radius:7px;padding:4px 8px;background:#172b42c9;color:#fff;font-size:11px;font-weight:600;backdrop-filter:blur(6px)}.photo-count svg{width:13px;height:13px}.info{padding:21px 22px 17px;flex:1}.info h2{margin:0 0 12px;font-size:22px;line-height:1.2;letter-spacing:-.55px;font-weight:700}.info h2 a:hover{color:var(--dk-accent)}.facts{display:flex;gap:7px 14px;flex-wrap:wrap;color:var(--dk-muted);font-size:12px;line-height:1.5;margin:0 0 14px}.facts span{display:inline-flex;align-items:center;gap:5px}.facts svg{width:15px;height:15px;color:#71849a;flex:none}.amenities{display:flex;gap:6px;flex-wrap:wrap;list-style:none;padding:0;margin:0 0 12px}.amenities li{display:inline-flex;align-items:center;gap:5px;background:#f1f5f9;border-radius:6px;padding:5px 8px;font-size:11px;line-height:1.2;color:#435b73}.amenities svg{width:13px;height:13px;flex:none;color:#587ba2}.description-preview{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;font-size:13px;line-height:1.6;color:var(--dk-muted);margin:0 0 14px}.details-link{display:inline-flex;align-items:center;min-height:36px;font-size:13px;font-weight:650;color:var(--dk-accent)}.details-link:hover{text-decoration:underline;text-underline-offset:4px}
    .price-area{padding:18px 22px 20px;border-top:1px solid #edf1f5;display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:91px}.price{margin:0;min-width:0;font-size:25px;letter-spacing:-.8px;font-weight:750;line-height:1.15;font-variant-numeric:tabular-nums;color:var(--dk-ink)}.price small{display:block;font-size:11px;line-height:1.5;font-weight:400;letter-spacing:0;color:var(--dk-muted);margin-top:6px}.price-area [data-domkazan-action-for] button,.booking-quote [data-domkazan-action-for] button{display:flex;justify-content:center;align-items:center;gap:8px;min-height:46px;padding:11px 13px!important;border-radius:10px!important;margin:0!important;background:var(--dk-accent)!important;font:600 13px/1.3 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;transition:background .15s}.price-area [data-domkazan-action-for] button:hover,.booking-quote [data-domkazan-action-for] button:hover{background:var(--dk-accent-hover)!important}.empty{padding:50px 24px;text-align:center;background:#fff;border:1px solid var(--dk-line);border-radius:18px}.empty h2{margin:0 0 10px;font-size:24px;letter-spacing:-.5px}.empty p{color:var(--dk-muted);max-width:460px;margin:0 auto;line-height:1.7}
    .back{display:inline-flex;align-items:center;gap:8px;min-height:40px;color:var(--dk-muted);font-size:13px;margin:0 0 16px}.back:hover{color:var(--dk-accent)}.gallery{min-width:0;margin:24px 0 30px}.house-layout{display:grid;grid-template-columns:minmax(0,1fr) 390px;gap:26px;align-items:start}.house-copy{background:#fff;border:1px solid var(--dk-line);border-radius:20px;padding:30px 32px}.house-copy h2{margin:0 0 20px;font-size:24px;letter-spacing:-.5px;font-weight:700}.house-copy p{white-space:pre-line;color:#42576e;margin:0;line-height:1.85;font-size:15px}.booking{min-width:0}.booking .search{border-radius:20px 20px 0 0;border-bottom:0;box-shadow:none;padding:24px 24px 12px}.booking h2{margin:0 0 20px;font-size:21px;line-height:1.25;letter-spacing:-.4px}.booking-quote{background:#fff;padding:18px 24px 24px;border:1px solid var(--dk-line);border-top:0;border-radius:0 0 20px 20px;box-shadow:0 10px 30px #243f6208}.booking-quote .price{font-size:32px}.booking-quote [data-domkazan-action-for] button{width:100%;margin-top:20px!important;font-size:15px!important;min-height:50px}.breakdown{color:var(--dk-muted);font-size:12px;line-height:1.6;margin:14px 0 0}.breakdown:empty{display:none}.contacts{display:flex;flex-wrap:wrap;gap:8px;margin-top:28px;padding-top:24px;border-top:1px solid var(--dk-line)}.contacts a{display:flex;align-items:center;justify-content:center;min-height:44px;padding:10px 14px;border:1px solid var(--dk-line);border-radius:9px;font-size:13px;font-weight:600;color:var(--dk-accent)}.contacts a:hover{background:#eef5ff;border-color:#b7d0f2}.house-copy .contact-note{font-size:12px;color:var(--dk-muted);margin:14px 0 0;line-height:1.6}.footer-note{font-size:12px;color:var(--dk-muted);text-align:center;margin:36px 0 0}.error{background:#fff2ef;border:1px solid #f2d0c8;padding:18px;border-radius:12px;color:#9b3424}.loading{padding:64px 24px;text-align:center;color:var(--dk-muted)}
    @media(hover:hover){.card:hover{box-shadow:0 12px 30px #243f6212;border-color:#c9d7e7}.cover:hover img{transform:scale(1.035)}}
    @media(max-width:1050px){.cards{grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}.house-layout{grid-template-columns:minmax(0,1fr) 350px;gap:20px}.house-copy{padding:24px}.booking .search{padding:20px 20px 12px}.booking-quote{padding:16px 20px 22px}}
    @media(max-width:760px){.shell{padding:20px 18px 36px}.top{margin-bottom:22px;padding-bottom:20px}.brand{font-size:22px}.city{display:none}.top-contact{font-size:12px;min-height:40px;padding:8px 11px}.search{padding:18px;border-radius:16px}.test-note{align-items:flex-start;gap:8px;margin:12px 0 24px;font-size:10px}.test-note b{font-size:9px;margin-top:1px}.toolbar{align-items:flex-start;flex-direction:column;gap:14px;margin:24px 0 18px}.count{font-size:22px}.sort-control{width:100%;justify-content:space-between}.sort-control select{font-size:13px;max-width:72%}.cards{grid-template-columns:1fr;gap:20px}.cover{aspect-ratio:16/10}.cover img{object-fit:contain}.info{padding:20px 20px 14px}.info h2{font-size:23px}.facts{font-size:12px}.price-area{padding:17px 20px 20px}.price{font-size:25px}.house-layout{grid-template-columns:1fr;gap:20px}.house-copy{padding:24px 22px;border-radius:16px}.house-copy h2{font-size:23px}.booking .search{border-radius:16px 16px 0 0}.booking-quote{border-radius:0 0 16px 16px}.gallery{margin:20px 0 24px}.intro .facts{font-size:13px}.contacts a{flex:1}.footer-note{margin-top:28px;line-height:1.7}}
    @media(max-width:380px){.shell{padding:18px 14px 32px}.brand{font-size:20px}.top-contact{font-size:11px;padding:8px 9px}.search{padding:16px}.price-area{flex-wrap:wrap}.price-area>div:has([data-domkazan-action-for]){width:100%}.price-area [data-domkazan-action-for] button{width:100%}.info{padding:18px 18px 12px}.house-copy{padding:22px 18px}.test-note{gap:6px}.facts{column-gap:10px}}
    @media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
    .contacts a{white-space:nowrap}
    .booking .search{border:1px solid var(--dk-line);border-radius:20px;padding:24px;box-shadow:0 8px 30px #243f6208}
    @media(max-width:760px){.booking .search{padding:20px;border-radius:16px}}
    .cover img{position:absolute;inset:0;object-fit:cover;opacity:0}.cover.has-photo img{opacity:1}.cover-status{position:absolute;inset:0;display:grid;place-content:center;padding:24px;text-align:center;color:var(--dk-muted);font-size:13px;background:linear-gradient(135deg,#e9eff5,#f5f7fa)}
    .cover .photo-count{z-index:1}.intro .eyebrow{margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--dk-accent)}
    .house-copy h2{margin-bottom:16px}.copy-section{margin:26px 0}.house-copy h3{font-size:16px;line-height:1.4;letter-spacing:-.2px;margin:0 0 12px;color:var(--dk-ink)}.house-copy ul:not(.amenities){list-style:none;padding:0;margin:0;display:grid;gap:10px}.house-copy ul:not(.amenities)>li{position:relative;padding-left:17px;color:#42576e;line-height:1.7;overflow-wrap:anywhere}.house-copy ul:not(.amenities)>li::before{content:'';position:absolute;left:0;top:.72em;width:5px;height:5px;border-radius:50%;background:#8ba7c6}.house-copy .spaces ul{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 24px}.house-copy .copy-note{font-size:12px;line-height:1.7;color:var(--dk-muted);margin:0 0 16px}.extra-conditions{margin:24px 0;padding:18px 0;border-top:1px solid var(--dk-line);border-bottom:1px solid var(--dk-line)}.extra-conditions summary{font-weight:650;font-size:15px;cursor:pointer;min-height:44px;display:list-item;align-content:center;margin-left:18px;padding-right:10px}.extra-conditions[open] summary{margin-bottom:12px}.extra-conditions li{font-size:13px}.booking-explainer{padding:20px;border-radius:12px;background:#f4f7fb;margin:26px 0 0}.booking-explainer p{font-size:13px;line-height:1.75}.booking-explainer h3{margin-bottom:8px}.price-placeholder{font-size:16px!important;font-weight:600!important;letter-spacing:0!important;line-height:1.5!important}.quote-lines{display:grid;gap:8px;margin:0;padding:0}.quote-lines>div{display:flex;justify-content:space-between;gap:16px;font-size:13px}.quote-lines dt{color:var(--dk-muted)}.quote-lines dd{margin:0;white-space:nowrap;color:var(--dk-ink);font-variant-numeric:tabular-nums}.breakdown .quote-note{margin:12px 0 0;font-size:12px;line-height:1.7}.quote-label{color:var(--dk-muted);font-size:12px;margin:0 0 8px}.booking .search{box-shadow:0 12px 35px #243f620a}.price-area .price-placeholder{max-width:220px}.house-copy .contacts{margin-top:26px}.house-copy .contact-note{overflow-wrap:anywhere}
    @media(min-width:1051px){.booking{position:sticky;top:24px}}
    @media(max-width:760px){.cover img{object-fit:cover}.house-copy .spaces ul{grid-template-columns:1fr}.copy-section{margin:24px 0}.booking-explainer{padding:16px}.house-copy h3{font-size:16px}.intro .eyebrow{font-size:10px}.quote-lines>div{font-size:12px}}
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
  function icon(name) {
    const paths = { guests:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
      rooms:'M3 21V3h13v18M3 21h18V9h-5M7 7h4M7 11h4M7 15h4M8 21v-3h3v3',beds:'M3 18v3M21 18v3M3 18h18V8H3v10M3 13h18M7 8V5h10v3',
      pool:'M2 19q2-2 4 0t4 0 4 0 4 0 4 0M2 23q2-2 4 0t4 0 4 0 4 0 4 0M6 15V5a3 3 0 0 1 6 0M16 15V5a3 3 0 0 1 6 0M6 8h10M6 12h10',
      sauna:'M5 17h14v4H5zM7 13c-3-4 3-4 0-8M12 13c-3-4 3-4 0-8M17 13c-3-4 3-4 0-8',billiards:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
      photos:'M4 7h3l2-3h6l2 3h3v13H4zM15 13a3 3 0 1 1-6 0 3 3 0 0 1 6 0' };
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    for(const [key,value] of Object.entries({viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'1.6','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',focusable:'false'}))svg.setAttribute(key,value);
    const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',paths[name]);svg.append(path);return svg;
  }
  function fact(value, symbol) { return el('span',{},[icon(symbol),document.createTextNode(value)]); }
  const facts = product => el('div', { class: 'facts' }, [
    ...(product.maxGuests ? [fact(`До ${product.maxGuests} гостей`,'guests')] : [text('span', 'Вместимость — уточните у владельца')]),
    ...(product.bedrooms ? [fact(`${product.bedrooms} ${plural(product.bedrooms, ['спальня', 'спальни', 'спален'])}`,'rooms')] : []),
    ...(product.beds ? [fact(`${product.beds} ${plural(product.beds, ['спальное место', 'спальных места', 'спальных мест'])}`,'beds')] : []),
  ]);
  const amenities = product => el('ul',{class:'amenities','aria-label':'Удобства дома'},Object.entries(searchLabels).filter(([key])=>product.amenities?.includes(key)).map(([key,label])=>el('li',{},[icon(key),document.createTextNode(label)])));
  function excerptFor(product) {
    return descriptionGroups(product).spaces.slice(0, 2).join(' · ');
  }

  // Presentation only: Tilda remains the source. Hide only complete, recognisable
  // nightly tariff lines; never discard mixed prose, restrictions or extra fees.
  function descriptionGroups(product) {
    const groups = { spaces: [], rules: [], extras: [] };
    for (const line of (product.description || product.facts || '').split('\n').map(value => value.trim()).filter(Boolean)) {
      if (/^[—–\-\s]+$/.test(line)) continue;
      if (/^(?:в\s+)?(?:будни|пятница|суббота|воскресенье|выходные)\s*[-–—:]?\s*\d[\d\s.,]*(?:₽|руб(?:\.|лей)?|р\.?)\s*$/iu.test(line)) continue;
      // These counts already have dedicated, labelled facts above the gallery.
      if (/^вместимость\s*до\s*\d+\s*гостей\s*$/i.test(line) && product.maxGuests) continue;
      if (/^\d+\s*(?:спальня|спальни|спален),?\s*\d+\s*спальных\s*мест\s*$/i.test(line) && product.bedrooms && product.beds) continue;
      if (/₽|руб|\d\s*р(?:[/.\s]|$)|цен[аы]|стоимость|сбор|оплачива|доплат/i.test(line)) groups.extras.push(line);
      else if (/возраст|не принима|запре|нельзя|залог|заезд|выезд|тиши|животн|курени|предоплат/i.test(line)) groups.rules.push(line);
      else groups.spaces.push(line);
    }
    return groups;
  }

  function houseDescription(product) {
    const groups = descriptionGroups(product);
    const info = el('div', { class: 'house-copy' }, [text('h2', 'О доме'), amenities(product)]);
    function section(title, lines, className) {
      if (!lines.length) return;
      info.append(el('section', { class: `copy-section ${className}` }, [text('h3', title),
        el('ul', {}, lines.map(line => text('li', line)))]));
    }
    section('Пространство и удобства', groups.spaces, 'spaces');
    section('Правила проживания', groups.rules, 'rules');
    if (groups.extras.length) {
      info.append(el('details', { class: 'extra-conditions' }, [text('summary', 'Доплаты и условия владельца'),
        text('p', 'Справочные условия из описания дома. Актуальная стоимость проживания — в расчёте по датам. Дополнительные услуги и окончательные условия согласуйте с владельцем.', 'copy-note'),
        el('ul', {}, groups.extras.map(line => text('li', line)))]));
    }
    info.append(el('div', { class: 'booking-explainer' }, [text('h3', 'Как забронировать'),
      text('p', 'Выберите даты и гостей, проверьте стоимость и оставьте заявку. Владелец уточнит условия, оплату и подтвердит бронирование. Отправка заявки не закрепляет даты за вами.')]));
    return info;
  }

  function mountCover(cover, product, index) {
    const status = text('span', 'Загружаем фото…', 'cover-status');
    status.setAttribute('aria-hidden', 'true'); cover.append(status);
    if (!product.images.length) { status.textContent = 'Фото скоро появятся'; return; }
    const image = el('img', { alt: product.name, loading: index < 6 ? 'eager' : 'lazy', decoding: 'async', width: '600', height: '400' });
    let attempt = 0;
    image.addEventListener('load', async () => { try { await image.decode?.(); } catch { /* A loaded image remains usable when decode is unsupported. */ } cover.classList.add('has-photo'); status.remove(); });
    image.addEventListener('error', () => {
      if (++attempt < Math.min(product.images.length, 3)) image.src = product.images[attempt];
      else { image.remove(); status.textContent = 'Фото недоступно · открыть дом'; }
    });
    image.src = product.images[0]; cover.append(image);
  }

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
    if (!photos.length && !video) {
      root.replaceChildren(text('p','Фотографии дома уточните у владельца.','subtitle'));
      return { destroy() { root.replaceChildren(...original); } };
    }
    const shadow = root.shadowRoot || root.attachShadow({ mode: "open" }); shadow.replaceChildren();
    const style = document.createElement("style"); style.textContent = `
      :host{display:block;min-width:0;--dk-accent:#176bdf;color:#172b42;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}*{box-sizing:border-box}[hidden]{display:none!important}
      button{font:inherit;cursor:pointer;touch-action:manipulation;padding:10px;border:1px solid #dae3ee;border-radius:10px;background:#fff;color:#172b42;min-height:44px;min-width:44px}
      :focus-visible{outline:3px solid var(--dk-accent);outline-offset:3px}.viewer{position:relative;background:#eaf0f6;border:1px solid #e0e7ef;border-radius:18px;overflow:hidden;touch-action:pan-y}
      .photo-button{position:relative;display:flex;align-items:center;justify-content:center;width:100%;height:auto;aspect-ratio:16/9;max-height:600px;border:0;background:transparent;padding:0;cursor:zoom-in}.viewer img{display:block;width:100%;height:100%;object-fit:cover}
      iframe{display:block;width:100%;aspect-ratio:16/9;border:0}.navigation{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:14px 0;color:#586b80;font-size:13px;font-variant-numeric:tabular-nums}.navigation button{display:grid;place-items:center;font-size:20px;line-height:1;border-radius:50%;width:44px;height:44px;padding:0}.navigation button:hover{background:#eef5ff;border-color:#b6cdec;color:var(--dk-accent)}
      .thumbnails{display:flex;gap:9px;overflow-x:auto;padding:4px 3px 10px;scrollbar-width:thin}.thumbnails button{position:relative;padding:3px;min-width:80px;flex:none;border:1px solid #e0e7ef;background:#fff;overflow:hidden;border-radius:9px}.thumbnails img{display:block;width:78px;height:58px;object-fit:cover;background:#f0f3f7}
      [aria-current=true]{outline:2px solid var(--dk-accent);outline-offset:-1px}.thumbnails button:hover{border-color:var(--dk-accent)}dialog{max-width:96vw;max-height:96vh;padding:12px;border:0;border-radius:16px;background:#fff}dialog::backdrop{background:#101f32d9;backdrop-filter:blur(5px)}dialog img{display:block;max-height:80vh;max-width:90vw;width:auto;object-fit:contain;margin:auto}dialog>button{display:block;margin:0 0 10px auto;font-size:13px}
      .gallery-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:0 0 14px}.gallery-heading h2{margin:0;font-size:15px;font-weight:650}.gallery-heading button{min-height:44px;border-radius:100px;font-size:12px;padding:8px 14px;color:#176bdf}.zoom-hint{position:absolute;right:16px;bottom:16px;border:1px solid #ffffff60;border-radius:100px;background:#172b42dd;color:#fff;box-shadow:0 2px 12px #172b4220;padding:9px 14px;font-size:12px;font-weight:600;pointer-events:none}.gallery-note{margin:0 0 12px;color:#586b80;font-size:12px}
      @media(max-width:760px){.viewer{border-radius:14px}.photo-button{height:auto;aspect-ratio:4/3;max-height:440px}.navigation{margin:10px 0}.thumbnails button{min-width:70px}.thumbnails img{width:64px;height:48px}.zoom-hint{right:12px;bottom:12px;font-size:11px;padding:7px 11px}.gallery-heading{margin-bottom:10px}}
      @media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
    `;
    const viewer = document.createElement("div"); viewer.className = "viewer"; viewer.tabIndex = 0; viewer.setAttribute("aria-label", "Галерея дома");
    const navigation = document.createElement("div"); navigation.className = "navigation";
    const previous = document.createElement("button"); previous.type = "button"; previous.textContent = "←"; previous.setAttribute("aria-label", "Предыдущее фото");
    const next = document.createElement("button"); next.type = "button"; next.textContent = "→"; next.setAttribute("aria-label", "Следующее фото");
    const caption = document.createElement("span"); caption.setAttribute("aria-live", "polite"); navigation.append(previous, caption, next);
    const thumbs = document.createElement("div"); thumbs.className = "thumbnails";
    const modal = document.createElement("dialog"); modal.setAttribute("aria-label", "Увеличенное фото");
    const close = document.createElement("button"); close.type = "button"; close.textContent = "Закрыть фото"; close.addEventListener("click", () => modal.close()); modal.append(close);
    const mediaStyle=document.createElement('style');mediaStyle.textContent=`
      .zoom-photo{position:relative;min-width:min(75vw,600px);min-height:200px}.zoom-photo img{opacity:0}.zoom-photo img.loaded{opacity:1}
      .media-status{position:absolute;inset:0;display:grid;place-content:center;text-align:center;gap:12px;padding:24px;color:#586b80;background:#eaf0f6;font-size:13px;pointer-events:none}.media-status button{pointer-events:auto}.video-help{margin:10px 0;color:#586b80;font-size:12px}.video-help a{display:inline-flex;align-items:center;min-height:44px;color:#176bdf;text-underline-offset:3px}.zoom-nav{display:flex;align-items:center;justify-content:center;gap:16px;margin-top:12px}.zoom-nav span{min-width:60px;text-align:center}dialog img{min-height:100px}.photo-button img{opacity:0}.photo-button img.loaded{opacity:1}
    `;
    const videoHelp=document.createElement('p');videoHelp.className='video-help';videoHelp.hidden=true;
    if(video){videoHelp.append(document.createTextNode('Если плеер не работает: '));const fallback=document.createElement('a');fallback.href=rutubeUrl;fallback.textContent='Открыть видео в Rutube ↗';fallback.target='_blank';fallback.rel='noopener noreferrer';videoHelp.append(fallback);}
    const zoomNav=document.createElement('div');zoomNav.className='zoom-nav';
    const zoomPrevious=previous.cloneNode(true),zoomNext=next.cloneNode(true),zoomCaption=document.createElement('span');
    zoomCaption.setAttribute('aria-live','polite');zoomNav.append(zoomPrevious,zoomCaption,zoomNext);modal.append(zoomNav);
    let current = 0; const total = photos.length + Number(Boolean(video));
    const photoSources=photos.map(photo=>photo.src);let retrySequence=0;
    function retryPhoto(){
      // A thumbnail may still hold the old request open. A new node with the
      // same URL can share that stalled request, so retry with a fresh URL.
      const url=new URL(photos[current].src,location.href);
      url.searchParams.set('_dk_retry',`${Date.now()}-${++retrySequence}`);
      photoSources[current]=url.href;
      const thumb=thumbs.children[current]?.querySelector('img');if(thumb)thumb.src=url.href;
    }
    let stopPhoto=()=>{},stopZoom=()=>{};
    function watchPhoto(photo,status,retryAction){
      let active=true;
      function failed(message){
        if(!active)return;
        clearTimeout(timer);status.replaceChildren(document.createTextNode(message));
        const retry=el('button',{type:'button',text:'Повторить загрузку фото'});retry.addEventListener('click',retryAction);status.append(retry);
      }
      const timer=setTimeout(()=>failed('Фото загружается дольше обычного.'),15000);
      photo.addEventListener('load',async()=>{
        try{await photo.decode?.();}catch{/* A loaded image can still be displayed. */}
        if(!active)return;
        clearTimeout(timer);photo.classList.add('loaded');status.remove();
      });
      photo.addEventListener('error',()=>failed('Фото временно недоступно.'));
      return()=>{active=false;clearTimeout(timer);};
    }
    previous.disabled=next.disabled=total<2;
    modal.addEventListener('close',()=>{stopZoom();viewer.querySelector('button')?.focus({preventScroll:true});});
    function renderZoom(){
      stopZoom();modal.querySelector('.zoom-photo')?.remove();
      const image=el('img',{alt:photos[current].alt});
      const status=el('div',{class:'media-status',role:'status',text:'Загружаем фото…'});
      stopZoom=watchPhoto(image,status,()=>{retryPhoto();render();renderZoom();close.focus({preventScroll:true});});
      image.src=photoSources[current];modal.insertBefore(el('div',{class:'zoom-photo'},[image,status]),zoomNav);
      zoomCaption.textContent=`${current+1} / ${photos.length}`;zoomPrevious.hidden=zoomNext.hidden=photos.length<2;
    }
    function moveZoom(delta){current=(current+delta+photos.length)%photos.length;render();renderZoom();}
    zoomPrevious.addEventListener('click',()=>moveZoom(-1));zoomNext.addEventListener('click',()=>moveZoom(1));
    modal.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();moveZoom(event.key==='ArrowLeft'?-1:1);}});
    function render() {
      stopPhoto();
      viewer.replaceChildren(); caption.textContent = `${current + 1} / ${total}`;videoHelp.hidden=current<photos.length;
      [...thumbs.children].forEach((thumb, index) => thumb.setAttribute("aria-current", String(index === current)));
      const active=thumbs.children[current];if(active){const target=Math.max(0,active.offsetLeft-thumbs.offsetLeft-(thumbs.clientWidth-active.clientWidth)/2);thumbs.scrollLeft=target;}
      if (current < photos.length) {
        const photo = document.createElement("img");photo.alt = photos[current].alt;
        const status=document.createElement('div');status.className='media-status';status.setAttribute('role','status');status.textContent='Загружаем фото…';
        stopPhoto=watchPhoto(photo,status,()=>{retryPhoto();render();viewer.querySelector('button')?.focus({preventScroll:true});});
        photo.src=photoSources[current];
        const zoom = document.createElement("button"); zoom.type = "button"; zoom.className = "photo-button"; zoom.setAttribute("aria-label", "Увеличить фото");
        const hint=text('span','Смотреть весь кадр ↗','zoom-hint');hint.setAttribute('aria-hidden','true');
        zoom.addEventListener("click", () => { if(!photo.complete||!photo.naturalWidth)return;renderZoom();modal.showModal(); }); zoom.append(photo,hint); viewer.append(zoom,status);
      } else {
        const iframe = document.createElement("iframe"); iframe.src = video; iframe.title = "Видео дома на Rutube";
        iframe.allow = "fullscreen; picture-in-picture"; iframe.allowFullscreen = true; iframe.referrerPolicy = "strict-origin-when-cross-origin";
        iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-presentation"); viewer.append(iframe);
      }
    }
    function move(delta) { current = (current + delta + total) % total; render(); }
    previous.addEventListener("click", () => move(-1)); next.addEventListener("click", () => move(1));
    shadow.addEventListener("keydown", (event) => { if (modal.open) return; if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); move(event.key === "ArrowLeft" ? -1 : 1); } });
    let start = null;let suppressClick=false;
    viewer.addEventListener('click',event=>{if(suppressClick){event.preventDefault();event.stopImmediatePropagation();suppressClick=false;}},true);
    viewer.addEventListener("pointerdown", (event) => { suppressClick=false;if (event.pointerType === "touch") start = {x:event.clientX,y:event.clientY}; });
    viewer.addEventListener("pointerup", (event) => { if (start !== null && Math.abs(event.clientX-start.x)>45&&Math.abs(event.clientX-start.x)>Math.abs(event.clientY-start.y)) {suppressClick=true;move(event.clientX<start.x?1:-1);} start = null; });
    viewer.addEventListener("pointercancel", () => { start = null; });
    for (let index = 0; index < total; index++) {
      const button = document.createElement("button"); button.type = "button";
      button.setAttribute("aria-label", index < photos.length ? `Фото ${index + 1}` : "Видео Rutube");
      if (index < photos.length) {
        const thumb = document.createElement("img"); thumb.alt = ""; thumb.loading = index < 6 ? "eager" : "lazy"; thumb.decoding='async';
        thumb.addEventListener('error',()=>{thumb.remove();button.textContent=String(index+1);button.style.cssText='width:86px;height:66px';});
        thumb.src = photos[index].src; button.append(thumb);
      }
      else button.textContent = "Видео";
      button.addEventListener("click", () => { current = index; render(); }); thumbs.append(button);
    }
    const galleryHeading=el('div',{class:'gallery-heading'},[text('h2',`${photos.length} ${plural(photos.length,['фотография','фотографии','фотографий'])}`)]);
    if(video){const videoShortcut=el('button',{type:'button',text:'Смотреть видео', 'aria-label':'Перейти к видео дома'});videoShortcut.addEventListener('click',()=>{current=photos.length;render();viewer.focus({preventScroll:true});});galleryHeading.append(videoShortcut);}
    shadow.append(style,mediaStyle,galleryHeading, viewer,videoHelp, navigation, thumbs, modal); render();
    return { destroy() { stopPhoto();stopZoom();if (modal.open) modal.close(); shadow.replaceChildren(document.createElement("slot")); root.replaceChildren(...original); } };
  }
  function mountPage({ root, apiOrigin, privacyUrl, pagePath = window.location.pathname, testMode = true, catalogData, catalogReturn }) {
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
      let response,data;
      if(catalogData)data=await catalogData;
      else {const timer=setTimeout(()=>abort.abort(),10000);try{response=await fetch(new URL('/api/catalog', origin), { signal: abort.signal });data=await response.json();}finally{clearTimeout(timer);}if(!response.ok)throw new Error('Каталог временно недоступен.');}
      if (!Array.isArray(data.products)) throw new Error('Каталог временно недоступен.');
      if (!alive) return;
      const products = data.products.filter(product => /^\d{12}$/.test(product.productUid) && product.slug === `tilda-${product.productUid}`);
      const bySlug = new Map(products.map(product => [product.slug, product]));
      const byUid = new Map(products.map(product => [product.productUid, product]));
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
        document.title='Дом не найден — DomKazan';
        shell.append(link('← Все дома', houseUrl(null), 'back'), text('h1', 'Дом не найден'), text('p', 'Возможно, он был удалён из каталога. Выберите другой вариант.', 'subtitle'));
        root.dispatchEvent(new CustomEvent('domkazan:ready',{bubbles:true}));
        root.dispatchEvent(new CustomEvent('domkazan:view-ready',{bubbles:true}));
        return;
      }
      const returnUrl=selected&&catalogReturn?.uid===selected.productUid?catalogReturn.url:houseUrl(null,values);
      if (selected) shell.append(link('← К результатам поиска', returnUrl, 'back'));
      const intro = el('div', { class: 'intro' }, selected ? [text('h1', selected.name), facts(selected)] : [text('h1','Каталог загородных домов')]);
      if(!selected){intro.prepend(text('p','Отдых в Казани и рядом','eyebrow'));intro.append(text('p','Найдите дом для своей компании — с подходящими датами, удобствами и понятной стоимостью.','subtitle'));}
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
      let resultsContext;
      let sortControl;
      let empty;
      let breakdown;
      let detailResult;
      let detailPrice;

      if (selected) {
        document.title = `${selected.name} — DomKazan, тест`;
        const galleryRoot = el('div', { class:'gallery' }, selected.images.map(src => el('img', { 'data-original':src, alt:selected.name })));
        shell.append(galleryRoot); media = mountGallery({root:galleryRoot, rutubeUrl:selected.rutubeUrl});
        const info = houseDescription(selected);
        const contacts = el('div', { class: 'contacts' }, [link('Позвонить', 'tel:+79053106605'),
          link('Telegram ↗', 'https://t.me/viteek_b'), link('WhatsApp ↗', 'https://wa.me/message/OZ7WM2IJUPIXM1')]);
        for (const item of contacts.querySelectorAll('a[href^="https:"]')) { item.target = '_blank'; item.rel = 'noopener noreferrer'; }
        info.append(contacts, text('p', 'Свяжитесь с владельцем, чтобы уточнить условия. На стенде отправляйте только тестовые заявки.', 'contact-note'));
        const price = text('p', 'Выберите даты для расчёта', 'price price-placeholder');detailPrice=price;
        const action = el('div');
        breakdown = el('div', {class:'breakdown'});
        const quote = el('div', { class: 'booking-quote' }, [price, breakdown, action]);
        detailResult=quote;
        cards.push({ slug: selected.slug, element: quote, priceElement: price, actionElement: action });
        const booking = el('aside', { class: 'booking','aria-label':'Стоимость и заявка' }, [searchPanel, notice]);
        // The booking controls precede long descriptions for mobile and keyboard users.
        const layout=el('div', { class: 'house-layout' }, [galleryRoot,booking,info]);
        const layoutStyle=el('style',{text:'.house-layout{grid-template-areas:"gallery booking" "copy booking"}.house-layout>.gallery{grid-area:gallery;margin:0}.house-copy{grid-area:copy}.booking{grid-area:booking}@media(max-width:760px){.house-layout{grid-template-areas:"gallery" "booking" "copy"}}'});
        shell.append(layoutStyle,layout);
      } else {
        document.title='Каталог домов — DomKazan, тест';
        const sort = el('select', {'aria-label':'Сортировать',title:'Сортировка полной стоимости доступна после поиска'}, [['default', 'Порядок каталога'], ['price', 'Сначала дешевле'], ['price-desc', 'Сначала дороже']].map(([value, label]) => el('option', { value, text: label })));
        sort.disabled=true;sortControl=sort;
        sort.value = filter.sort;
        const sortLabel = text('label', 'Сортировать', 'sort-control'); sortLabel.append(sort);
        sort.addEventListener('change', () => {
          filter.sort = sort.value;
          if (lastResult) applyResults(lastResult.houses, lastResult.snapshot, false);
        });
        counter = text('span', `${products.length} ${plural(products.length, ['дом', 'дома', 'домов'])} в каталоге`, 'count');
        resultsContext=text('p','Выберите даты — покажем свободные дома и стоимость поездки.','results-context');
        const toolbar = el('div', { class:'toolbar', tabindex:'-1' }, [el('div',{'aria-live':'polite','aria-atomic':'true'},[el('h2', {}, [counter]),resultsContext]), sortLabel]);
        shell.append(toolbar);
        list = el('div', { class: 'cards grid', 'aria-label': 'Каталог домов' });
        for (const [index, product] of products.entries()) {
          const href = houseUrl(product.productUid, values);
          const cover = el('a', { href, class: 'cover', 'aria-label': `Подробнее: ${product.name}` });
          mountCover(cover, product, index);
          cover.append(el('span',{class:'photo-count'},[icon('photos'),document.createTextNode(`${product.images.length} фото`)]));
          const titleLink = link(product.name, href);
          const details = link('Подробнее о доме →', href, 'details-link');
          const excerpt = excerptFor(product);
          const info = el('div', { class: 'info' }, [el('h2', {}, [titleLink]), facts(product), amenities(product), ...(excerpt?[text('p',excerpt,'description-preview')]:[]), details]);
          // A copied Tilda tariff is not a current database quote.
          const price = text('p', 'Узнать стоимость', 'price price-placeholder');
          price.append(text('small', 'выберите даты и гостей'));
          const actions = el('div');
          const card = el('article', { class: 'card', 'data-domkazan-house': product.slug }, [cover, info, el('div', { class: 'price-area' }, [price, actions])]);
          cards.push({ slug: product.slug, element: card, priceElement: price, actionElement: actions });
          cardLinks.push({ product, nodes: [cover, titleLink, details] }); list.append(card);
        }
        empty = el('div', { class: 'empty', hidden: '' }, [text('h2', 'Подходящих домов не нашлось'), text('p', 'Попробуйте другие даты, уменьшите число гостей или снимите часть фильтров.')]);
        shell.append(list, empty, text('p', 'Вы выбираете дом на нашем сайте. Детали заезда и оплату согласуем лично.', 'footer-note'));
      }

      function applyResults(houses, snapshot, scroll = true) {
        const params = paramsWithFilters({checkIn:snapshot.checkIn, checkOut:snapshot.checkOut, guests:snapshot.guests});
        window.history.replaceState(window.history.state, '', houseUrl(selected?.productUid, params));
        for (const {product,nodes} of cardLinks) for (const node of nodes) node.href = houseUrl(product.productUid, params);
        if (counter) counter.textContent = `Найдено домов: ${houses.length}`;
        if (resultsContext) resultsContext.textContent=`${snapshot.checkIn.split('-').reverse().join('.')} — ${snapshot.checkOut.split('-').reverse().join('.')} · ${snapshot.guests} ${plural(Number(snapshot.guests),['гость','гостя','гостей'])} · цена за весь период`;
        if (sortControl) sortControl.disabled=false;
        if (empty) empty.hidden = houses.length > 0;
        if (list) {
          const sorted = [...houses].sort((a,b) => filter.sort === 'default' ? products.indexOf(bySlug.get(a.slug)) - products.indexOf(bySlug.get(b.slug)) :
            (Number(a.quote.total)-Number(b.quote.total)) * (filter.sort === 'price-desc' ? -1 : 1));
          for (const [index, house] of sorted.entries()) cards.find(card => card.slug === house.slug).element.style.order = String(index);
          // Visual order and keyboard/screen-reader order must agree.
          const order=new Set(sorted.map(house=>house.slug));
          for(const house of sorted)list.append(cards.find(card=>card.slug===house.slug).element);
          for(const card of cards)if(!order.has(card.slug))list.append(card.element);
          // A price sort may reveal houses originally far below the fold.
          for(const house of sorted.slice(0,6)){const image=cards.find(card=>card.slug===house.slug).element.querySelector('.cover img');if(image)image.loading='eager';}
          if (scroll && !resuming) shadow.querySelector('.toolbar').scrollIntoView?.({behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
        }
        if (breakdown && houses[0]) {
          const quote=houses[0].quote;
          const lines=el('dl',{class:'quote-lines','aria-label':'Состав стоимости'});
          for(const [label,value] of [['Проживание',quote.accommodationTotal],['Дополнительные гости',quote.extraGuestTotal],['Сервисный сбор',quote.serviceFee]]){
            if(value!==undefined&&Number(value)>0)lines.append(el('div',{},[text('dt',label),text('dd',`${rub(value)} ₽`)]));
          }
          breakdown.replaceChildren(...(lines.children.length?[lines]:[]),text('p',`${lines.children.length?'Проживание и перечисленные доплаты включены в итог.':'Стоимость за выбранные даты и гостей.'} Дополнительные услуги согласуются с владельцем отдельно.`,'quote-note'));
        }
        lastResult={houses,snapshot}; resuming=false;
      }
      widget = window.DomKazanCalendar.mount({ root: search, apiUrl: new URL('/api/availability', origin).href,
        privacyUrl: privacyUrl || new URL('/test-policy', origin).href, cards, initialValues: values, testMode,
        houseSlug:selected?.slug, showCount:!selected,quietSuccess:!selected,
        resultElement:detailResult,
        calendarUrl:selected?new URL(`/api/house-calendar?house=${selected.slug}`,origin).href:undefined,
        resultsUrl:()=>selected?returnUrl:houseUrl(null,paramsWithFilters(widget.values())),
        ownerContacts:{phone:'tel:+79053106605',telegram:'https://t.me/viteek_b',whatsapp:'https://wa.me/message/OZ7WM2IJUPIXM1'},
        getFilters:()=>({amenities:filter.amenities.join(',')}),
        renderPrice(target, house) {
          target.classList.remove('price-placeholder');
          target.replaceChildren(document.createTextNode(`${rub(house.quote.total)} ₽ `), text('small', `за ${house.quote.nights} ноч.`));
        },
        getViewState: filterState,
        transformHouses(houses) {
          return houses.flatMap(house => {
            // Older test Previews have no UID field. Explicit null means that
            // the administrator removed the mapping: never guess from a slug.
            const product = Object.hasOwn(house,'tildaProductUid')
              ? byUid.get(house.tildaProductUid)
              : bySlug.get(house.slug);
            return product && (!selected || selected.productUid === product.productUid)
              ? [{...house,slug:product.slug}] : [];
          });
        },
        onInvalidate(currentValues) {
          lastResult=null;
          if (counter) counter.textContent = `${products.length} ${plural(products.length, ['дом', 'дома', 'домов'])} в каталоге`;
          if (resultsContext) resultsContext.textContent='Условия изменены — выполните поиск заново.';
          if (sortControl) sortControl.disabled=true;
          if (empty) empty.hidden = true;
          if (breakdown) breakdown.textContent = '';
          if (detailPrice) detailPrice.classList.add('price-placeholder');
          for (const { product, nodes } of cardLinks) {for (const node of nodes) node.href = houseUrl(product.productUid, paramsWithFilters(currentValues));cards.find(card=>card.slug===product.slug)?.priceElement.classList.add('price-placeholder');}
        },
        onResults:applyResults,
        onRequestSaved(house,snapshot){
          if(lastResult)applyResults(lastResult.houses.map(item=>item.id===house.id?house:item),snapshot,false);
        },
        onSearchComplete:()=>root.dispatchEvent(new CustomEvent('domkazan:view-ready',{bubbles:true})),
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
      root.dispatchEvent(new CustomEvent('domkazan:ready', { bubbles: true, detail: { count: products.length } }));
      if (values.checkIn && values.checkOut) {resuming=true;if(widget.search()===false)root.dispatchEvent(new CustomEvent('domkazan:view-ready',{bubbles:true}));}
      else root.dispatchEvent(new CustomEvent('domkazan:view-ready',{bubbles:true}));
    }
    load().catch(() => {
      if (!alive) return;
      shadow.querySelector('.loading')?.remove();
      const failure=el('div',{class:'error',role:'status'},[text('p','Не удалось загрузить каталог. Проверьте соединение и попробуйте ещё раз.')]);
      const retry=el('button',{type:'button',text:'Загрузить каталог повторно'});retry.addEventListener('click',()=>window.location.reload());failure.append(retry);shadow.append(failure);
      root.dispatchEvent(new CustomEvent('domkazan:error', { bubbles: true }));
    });
    function pageShown(event){if(event.persisted&&widget){resuming=true;widget.search();}}
    window.addEventListener('pageshow',pageShown);
    return { destroy() { alive = false; abort.abort(); widget?.destroy(); media?.destroy(); window.removeEventListener('pageshow',pageShown); shadow.replaceChildren(); } };
  }
  function mount(options) {
    const root=options.root;
    if(!root||!window.DomKazanCalendar)throw new Error('Модуль поиска не загружен.');
    if(new URL(options.apiOrigin).protocol!=='https:')throw new Error('Требуется HTTPS API.');
    const pagePath=new URL(options.pagePath||location.pathname,location.origin).pathname;
    const previousRestoration=history.scrollRestoration;
    history.scrollRestoration='manual';
    const controller=new AbortController();
    const timer=options.catalogData===undefined?setTimeout(()=>controller.abort(),10000):undefined;
    // Content is reused within this visit; every view still rechecks availability.
    let catalogData=options.catalogData!==undefined?Promise.resolve(options.catalogData):fetch(new URL('/api/catalog',options.apiOrigin),{signal:controller.signal})
      .then(async response=>{if(!response.ok)throw new Error('Каталог временно недоступен.');return response.json();})
      .finally(()=>clearTimeout(timer));
    let current,overlay,alive=true,revision=0,navigating=false,restorePending=false,engaged=false;
    const engage=()=>{engaged=true;};
    for(const event of ['pointerdown','keydown','input','wheel'])root.addEventListener(event,engage,{passive:true});
    if(options.refreshCatalogData)Promise.resolve(options.refreshCatalogData).then(data=>{
      if(!alive||!Array.isArray(data?.products)||!data.products.length)return;
      catalogData=Promise.resolve(data);
      // Never replace an active form, gallery or search result. Navigation uses
      // the fresh content next time; an untouched initial view can refresh now.
      const query=new URLSearchParams(location.search);
      if(!engaged&&!navigating&&!(query.has('checkIn')&&query.has('checkOut')))render();
    }).catch(()=>{/* Public metadata cache stays usable; search still uses the live API. */});
    function removeOverlay(){overlay?.remove();overlay=null;root.inert=false;}
    function readReturn(){
      try{
        const fromHistory=history.state?.domkazanCatalogReturn;
        const value=fromHistory||JSON.parse(sessionStorage.getItem('domkazan.catalog.return.v1'));
        if(!value||!Number.isFinite(value.y)||!/^\d{12}$/.test(value.uid))return null;
        const url=new URL(value.url,location.origin);
        if(url.origin!==location.origin||url.pathname!==pagePath||url.searchParams.has('house')||url.hash)return null;
        if(!fromHistory){const currentUrl=new URL(location.href);currentUrl.searchParams.delete('house');if(currentUrl.pathname+currentUrl.search!==url.pathname+url.search)return null;}
        return{...value,url:url.pathname+url.search};
      }catch{return null;}
    }
    function ready(){
      // Restore once per navigation, not on the next explicit search in this view.
      if(!restorePending)return;
      restorePending=false;
      const token=revision;
      const isCatalog=!new URL(location.href).searchParams.has('house');
      let saved;
      if(isCatalog){const value=readReturn();if(value?.url===location.pathname+location.search)saved=value;}
      let focus;
      if(navigating||saved){
        window.scrollTo?.({top:isCatalog?Math.max(0,saved?.y||0):0,behavior:'instant'});
        if(navigating)focus=root.shadowRoot?.querySelector(saved?.uid?`[data-domkazan-house="tilda-${saved.uid}"] h2 a`:'h1');
      }
      (window.requestAnimationFrame||((callback)=>setTimeout(callback,0)))(()=>{if(alive&&revision===token){removeOverlay();navigating=false;if(focus){if(focus.tagName==='H1')focus.tabIndex=-1;focus.focus({preventScroll:true});}}});
    }
    function render(){
      revision++;restorePending=true;current?.destroy();
      current=mountPage({...options,pagePath,catalogData,catalogReturn:readReturn()});
    }
    function showTransition(isCatalog){
      navigating=true;root.inert=true;
      if(!overlay){overlay=document.createElement('div');overlay.setAttribute('data-domkazan-transition','');overlay.setAttribute('role','status');overlay.style.cssText='position:fixed;inset:0;z-index:2147483000;display:grid;place-content:center;padding:24px;background:#f5f7fa;color:#172b42;text-align:center;font:500 15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';document.body.append(overlay);}
      overlay.textContent=isCatalog?'Возвращаемся к каталогу…':'Открываем дом…';
    }
    function clicked(event){
      if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
      const anchor=event.composedPath().find(node=>node?.tagName==='A'&&node.hasAttribute('href'));
      if(!anchor||anchor.hasAttribute('download')||(anchor.target&&anchor.target!=='_self'))return;
      let target;try{target=new URL(anchor.href,location.href);}catch{return;}
      if(target.origin!==location.origin||target.pathname!==pagePath||target.hash)return;
      event.preventDefault();
      let catalogReturn=readReturn();
      if(!new URL(location.href).searchParams.has('house')&&target.searchParams.has('house')){
        const back=new URL(target);back.searchParams.delete('house');
        catalogReturn={url:back.pathname+back.search,y:scrollY,uid:target.searchParams.get('house')};
        history.replaceState({...history.state,domkazanCatalogReturn:catalogReturn},'',catalogReturn.url);
        try{sessionStorage.setItem('domkazan.catalog.return.v1',JSON.stringify(catalogReturn));}catch{/* History retains the return point when storage is unavailable. */}
      }
      showTransition(!target.searchParams.has('house'));
      history.pushState({...history.state,domkazanCatalogReturn:catalogReturn},'',target.pathname+target.search);render();
    }
    function popped(){if(location.pathname===pagePath){showTransition(!new URL(location.href).searchParams.has('house'));render();}}
    root.addEventListener('click',clicked);
    root.addEventListener('domkazan:view-ready',ready);
    root.addEventListener('domkazan:error',removeOverlay);
    window.addEventListener('popstate',popped);
    render();
    return{destroy(){alive=false;controller.abort();clearTimeout(timer);current?.destroy();removeOverlay();for(const event of ['pointerdown','keydown','input','wheel'])root.removeEventListener(event,engage);root.removeEventListener('click',clicked);root.removeEventListener('domkazan:view-ready',ready);root.removeEventListener('domkazan:error',removeOverlay);window.removeEventListener('popstate',popped);history.scrollRestoration=previousRestoration;}};
  }
  window.DomKazanCatalog = { mount };
})();
