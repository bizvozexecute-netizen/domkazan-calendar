/* DomKazan catalog adapter. Tilda cards remain the source of catalog content. */
(() => {
  const instances = new WeakMap();
  const DAY = 86400000;
  const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || "") && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  const addDays = (value, days) => new Date(Date.parse(`${value}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
  const today = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Moscow" }).format(new Date());
  const dateLabel = (value) => validDate(value) ? value.split("-").reverse().join(".") : "Выберите дату";
  function rangeCalendar(form, onChange, options = {}) {
    const fields = {};
    const triggers = [];
    let month = today().slice(0, 7);
    let choosingEnd = false;
    let focusDay = today();
    let opener = null;
    const container = document.createElement("div");
    container.className = "calendar";
    container.hidden = true;
    container.setAttribute("role", "dialog");
    container.setAttribute("aria-label", "Выбор дат проживания");
    const caption = document.createElement("p"); caption.className = "calendar-caption"; caption.setAttribute("aria-live", "polite");
    const navigation = document.createElement("div"); navigation.className = "calendar-nav";
    const previous = document.createElement("button"); previous.type = "button"; previous.textContent = "←"; previous.setAttribute("aria-label", "Предыдущий месяц");
    const title = document.createElement("strong");
    const next = document.createElement("button"); next.type = "button"; next.textContent = "→"; next.setAttribute("aria-label", "Следующий месяц");
    navigation.append(previous, title, next);
    const grid = document.createElement("div"); grid.className = "calendar-grid"; grid.setAttribute("role", "group"); grid.setAttribute("aria-label","Дни месяца");
    const status = document.createElement("p"); status.setAttribute("role", "status");
    container.append(caption, navigation, grid, status);
    for (const [name, label] of [["checkIn", "Заезд"], ["checkOut", "Выезд"]]) {
      const field = document.createElement("input"); field.type = "hidden"; field.name = name;
      const wrapper = document.createElement("div"); wrapper.className = "date-field";
      const text = document.createElement("span"); text.textContent = label;
      const button = document.createElement("button"); button.type = "button"; button.className = "date-trigger";
      button.setAttribute("aria-label", label); button.setAttribute("aria-haspopup", "dialog"); button.setAttribute("aria-expanded", "false");
      button.addEventListener("click", () => open(button, name === "checkOut"));
      wrapper.append(text, button, field); form.append(wrapper); fields[name] = field; triggers.push(button);
    }
    form.append(container);
    function refreshLabels() {
      triggers[0].textContent = dateLabel(fields.checkIn.value);
      triggers[1].textContent = dateLabel(fields.checkOut.value);
    }
    function canEnd(day) {
      if (!fields.checkIn.value || day <= fields.checkIn.value || day > addDays(fields.checkIn.value, 60)) return false;
      const nights = (Date.parse(day)-Date.parse(fields.checkIn.value))/DAY;
      for (let night = fields.checkIn.value; night < day; night = addDays(night, 1)) {
        if (options.getDay && options.getDay(night)?.status !== "available") return false;
        if (options.getDay && nights < (options.getDay(night)?.minNights || 1)) return false;
      }
      return true;
    }
    function render() {
      const focusedDay = container.getRootNode().activeElement?.dataset?.day;
      refreshLabels(); grid.replaceChildren();
      caption.textContent = choosingEnd ? "Выберите выезд" : "Выберите заезд";
      title.textContent = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
      previous.disabled = month <= today().slice(0, 7);
      next.disabled = month >= addDays(today(), 730).slice(0, 7);
      for (const label of ["пн", "вт", "ср", "чт", "пт", "сб", "вс"]) {
        const day = document.createElement("span"); day.textContent = label; day.setAttribute("aria-hidden", "true"); grid.append(day);
      }
      const start = `${month}-01`;
      const offset = (new Date(`${start}T00:00:00Z`).getUTCDay() + 6) % 7;
      for (let index = 0; index < offset; index++) { const gap = document.createElement("span"); gap.setAttribute("aria-hidden", "true"); grid.append(gap); }
      for (let day = start; day.slice(0, 7) === month; day = addDays(day, 1)) {
        const cell = document.createElement("button"); cell.type = "button"; cell.dataset.day = day;
        const details = options.getDay?.(day);
        if (details) cell.dataset.status=details.status;
        const blocked = details && details.status !== "available";
        cell.disabled = day < today() || (choosingEnd ? !canEnd(day) : Boolean(options.getDay && (!details || blocked)));
        cell.textContent = String(Number(day.slice(8)));
        if (details) {
          const price = document.createElement("small");
          price.textContent = details.price === null ? "—" : Number(details.price).toLocaleString("ru-RU"); cell.append(price);
        }
        const description = details ? details.status === "occupied" ? "занято" : details.status === "unpriced" ? "нет тарифа" : details.status === "past" ? "прошедшая дата" : "свободно" : "";
        cell.setAttribute("aria-label", `${dateLabel(day)}${description ? `, ${description}` : ""}${details?.price !== null && details?.price !== undefined ? `, ${details.price} рублей` : ""}`);
        cell.setAttribute("aria-pressed", String(day === fields.checkIn.value || day === fields.checkOut.value));
        if (day >= fields.checkIn.value && fields.checkOut.value && day <= fields.checkOut.value) cell.classList.add("in-range");
        if (blocked) cell.classList.add(details.status === "unpriced" ? "unpriced" : "unavailable");
        cell.tabIndex = day === focusDay ? 0 : -1;
        cell.addEventListener("click", () => choose(day)); grid.append(cell);
      }
      const buttons = [...grid.querySelectorAll("button:not(:disabled)")];
      if (!buttons.some((button) => button.tabIndex === 0) && buttons.length) buttons[0].tabIndex = 0;
      if (focusedDay) (grid.querySelector(`[data-day="${focusedDay}"]:not(:disabled)`) || buttons[0] || next).focus({preventScroll:true});
      if(options.getDay) status.textContent='Цена за ночь без доплат. Синий — занято, «—» — нет тарифа. Итог рассчитывается отдельно.';
    }
    function choose(day) {
      status.textContent = "";
      if (!choosingEnd) { fields.checkIn.value = day; fields.checkOut.value = ""; choosingEnd = true; }
      else { if (!canEnd(day)) return; fields.checkOut.value = day; choosingEnd = false; }
      focusDay = day; onChange(); render();
      if (fields.checkOut.value) close();
      else (grid.querySelector(`[data-day="${addDays(day,1)}"]:not(:disabled)`) || next).focus();
    }
    function shift(delta) {
      const date = new Date(`${month}-01T00:00:00Z`); date.setUTCMonth(date.getUTCMonth() + delta);
      const value = date.toISOString().slice(0, 7);
      if (value < today().slice(0, 7) || value > addDays(today(), 730).slice(0, 7)) return;
      month = value; render(); options.onMonth?.(month);
    }
    previous.addEventListener("click", () => shift(-1)); next.addEventListener("click", () => shift(1));
    function open(button, end) {
      opener = button; choosingEnd = end && validDate(fields.checkIn.value);
      month = (fields.checkIn.value || today()).slice(0, 7); focusDay = choosingEnd ? addDays(fields.checkIn.value, 1) : fields.checkIn.value || today();
      container.hidden = false; triggers.forEach((trigger) => trigger.setAttribute("aria-expanded", "true"));
      render(); options.onMonth?.(month);
      (grid.querySelector(`button[data-day="${focusDay}"]:not(:disabled)`) || grid.querySelector("button:not(:disabled)") || next).focus();
    }
    function close() { container.hidden = true; triggers.forEach((trigger) => trigger.setAttribute("aria-expanded", "false")); opener?.focus({ preventScroll: true }); }
    container.addEventListener("keydown", (event) => {
      if (event.key === "Escape") { event.preventDefault(); close(); return; }
      if (event.key === "Tab") {
        const controls = [...container.querySelectorAll("button:not(:disabled)")].filter((button) => button.tabIndex >= 0);
        const index = controls.indexOf(container.getRootNode().activeElement);
        if (event.shiftKey && index <= 0) { event.preventDefault(); controls.at(-1)?.focus(); }
        else if (!event.shiftKey && index === controls.length - 1) { event.preventDefault(); controls[0]?.focus(); }
        return;
      }
      const cell = event.target.closest("[data-day]");
      if (!cell) return;
      const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
      if (delta) {
        event.preventDefault(); focusDay = addDays(cell.dataset.day, delta);
        if (focusDay.slice(0, 7) !== month) { shift(delta < 0 ? -1 : 1); }
        else render();
        grid.querySelector(`[data-day="${focusDay}"]:not(:disabled)`)?.focus();
      } else if (["PageUp", "PageDown"].includes(event.key)) { event.preventDefault(); shift(event.key === "PageUp" ? -1 : 1); }
    });
    const outside = (event) => { if (!container.hidden && !event.composedPath().some((element) => element === container || triggers.includes(element))) { container.hidden = true; triggers.forEach((trigger) => trigger.setAttribute("aria-expanded", "false")); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("click", outside);
    refreshLabels();
    return { refresh: render, set(start, end) { fields.checkIn.value = start || ""; fields.checkOut.value = end || ""; render(); }, destroy() { document.removeEventListener("pointerdown", outside); document.removeEventListener("click", outside); } };
  }
  const css = `
    :host{display:block;container-type:inline-size;--dk-accent:#176bdf;--dk-accent-hover:#1054b7;--dk-ink:#172b42;--dk-muted:#586b80;--dk-line:#dce5ef;font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--dk-ink);-webkit-font-smoothing:antialiased}
    *{box-sizing:border-box}[hidden]{display:none!important}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0}
    form{display:grid;grid-template-columns:repeat(3,minmax(0,1fr)) auto;gap:16px;align-items:end}form>*{min-width:0}label,.date-field{display:grid;gap:8px;font-size:12px;line-height:1.4;font-weight:600;color:#42576e}.date-trigger{text-align:left;border:1px solid var(--dk-line);background:#f7f9fc;color:var(--dk-ink);font-size:15px;font-weight:500}.date-trigger:hover:not(:disabled){background:#eef4fc;transform:none;filter:none;border-color:#a8c6ec}.date-trigger[aria-expanded=true]{border-color:var(--dk-accent);background:#fff;box-shadow:0 0 0 3px #176bdf10}
    input,textarea,select{width:100%;min-width:0;min-height:50px;padding:12px 14px;border:1px solid var(--dk-line);border-radius:10px;background:#f7f9fc;color:var(--dk-ink);font:400 16px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;transition:border-color .15s,box-shadow .15s}input:hover,textarea:hover,select:hover{border-color:#b4c7dd}input:focus-visible,textarea:focus-visible,select:focus-visible,button:focus-visible,a:focus-visible{outline:3px solid #176bdf;outline-offset:3px}input:focus-visible,textarea:focus-visible,select:focus-visible{background:#fff}input:disabled,textarea:disabled,select:disabled{opacity:1;color:#586b80;background:#f1f5f9}
    button{min-height:50px;padding:12px 20px;border:1px solid transparent;border-radius:10px;background:var(--dk-accent);color:#fff;font:600 14px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;cursor:pointer;touch-action:manipulation;transition:background .15s,border-color .15s}button:hover:not(:disabled){background:var(--dk-accent-hover)}button:disabled{cursor:default;opacity:.55}form[aria-busy=true]>button{cursor:progress}
    .search-amenities{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:8px;border:0;margin:2px 0 0;padding:16px 0 0;border-top:1px solid #edf1f6}.search-amenities label{display:flex;align-items:center;gap:7px;min-height:38px;padding:8px 12px;border:1px solid #e0e7ef;border-radius:8px;font-size:12px;font-weight:500;cursor:pointer;background:#fff;transition:background .15s,border-color .15s}.search-amenities label:hover{border-color:#a8c6ec}.search-amenities label:has(input:checked){border-color:#aac9f2;background:#edf5ff;color:#1056b5}.search-amenities input{appearance:auto;accent-color:var(--dk-accent);width:14px;height:14px;min-height:0;margin:0;padding:0;border-radius:3px;flex:none}
    .calendar{position:relative;grid-column:1/-1;background:#fff;border:1px solid var(--dk-line);border-radius:14px;padding:16px;width:min(100%,390px);box-shadow:0 8px 24px #243f620c}.calendar-caption{margin:0 0 12px;color:#586b80;font-size:12px}.calendar-nav{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:16px}.calendar-nav strong{font-size:15px;font-weight:650;color:var(--dk-ink)}.calendar-nav button{min-height:40px;min-width:40px;padding:8px;background:#f0f5fb;color:var(--dk-ink);font-size:17px;border:1px solid #e0e7ef}.calendar-nav button:hover:not(:disabled){background:#e1edfc;border-color:#a8c6ec}.calendar-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;text-align:center}.calendar-grid>span{padding:0 0 6px;color:#718399;font-size:11px}.calendar-grid button{min-height:44px;padding:7px 0;color:var(--dk-ink);background:#f4f7fb;border:1px solid transparent;border-radius:8px;font-size:13px;font-weight:550;font-variant-numeric:tabular-nums}.calendar-grid button:hover:not(:disabled){border-color:#85afe8;background:#e7f0fd}.calendar-grid small{display:block;font-size:9px;line-height:1.3;font-weight:400;letter-spacing:-.25px}.calendar-grid .in-range{background:#e4eefc;color:#174e91}.calendar-grid button[aria-pressed=true]{background:#172b42;color:#fff}.calendar-grid button:disabled{cursor:not-allowed;opacity:1;color:#7b8b9d;background:#f0f3f7}.calendar-grid [data-status=occupied]:disabled{background:#3a76b7;color:#fff}.calendar-grid [data-status=unpriced]:disabled{background:repeating-linear-gradient(135deg,#f3f5f8,#f3f5f8 4px,#e9eef3 4px,#e9eef3 5px);color:#677789}.calendar-grid [data-status=past]:disabled{background:#f0f3f7;color:#8996a6}.calendar>[role=status]{margin:12px 0 0;color:var(--dk-muted);font-size:11px;line-height:1.6}.calendar>[role=status]:empty{display:none}
    .message{margin:14px 0 0;padding:10px 12px;border-radius:9px;background:#f1f5fa;color:#425c78;font-size:12px;font-weight:500;line-height:1.6}.message:empty{display:none}.message[data-state=error]{background:#fff1ee;color:#a2392b}.message[data-state=stale]{background:#fff7e9;color:#79521b}.message[data-state=success]{background:#eef6f2;color:#2c6752}.message[data-state=loading]{background:#edf5ff;color:#215caa}
    .request-form{grid-template-columns:repeat(2,minmax(0,1fr));margin-top:22px;padding:22px;border:1px solid var(--dk-line);border-radius:16px;background:#fff}.request-form h2{margin:0;font-size:23px;line-height:1.25;letter-spacing:-.5px;font-weight:700}.request-form textarea{min-height:90px;resize:vertical;background:#fff}.request-form select{background:#fff}.request-form .wide{grid-column:1/-1}.summary{grid-column:1/-1;display:grid;gap:8px;margin:0;padding:16px;background:#f2f6fb;border:1px solid #e4ebf4;border-radius:11px}.summary div{display:grid;grid-template-columns:82px minmax(0,1fr);align-items:baseline;gap:12px;margin:0;font-size:13px}.summary dt{font-weight:400;color:var(--dk-muted)}.summary dd{margin:0;font-weight:550;overflow-wrap:anywhere}.summary div:last-child{border-top:1px solid #dce5f0;margin-top:4px;padding-top:12px}.summary div:last-child dd{font-size:22px;letter-spacing:-.6px;font-weight:700}.consent{display:flex;align-items:flex-start;gap:9px;font-size:11px;font-weight:400;line-height:1.7}.consent input{width:16px;height:16px;min-height:0;margin:2px 0 0;padding:0;accent-color:var(--dk-accent);flex:none}.consent a{color:var(--dk-accent);text-underline-offset:3px}.honeypot{position:absolute;left:-10000px}.contacts{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}.contacts a{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:9px 12px;border:1px solid #d2e1d9;border-radius:8px;background:#fff;color:#176bdf;font-size:12px;font-weight:600;text-decoration:none}.contacts a:hover{border-color:#a1bddf}.receipt{grid-column:1/-1;padding:18px;border:1px solid #c3dfd0;border-radius:12px;background:#f0f8f3;color:#265f47;font-size:13px;line-height:1.6}.receipt p{margin:0}.return-link{display:inline-flex;align-items:center;min-height:44px;margin:12px 0 0;color:var(--dk-accent);font-weight:600;font-size:13px;text-underline-offset:4px}
    @media(max-width:900px){form:not(.request-form){grid-template-columns:repeat(3,minmax(0,1fr))}form:not(.request-form)>button{grid-column:1/-1}}
    @media(max-width:600px){form,form:not(.request-form){grid-template-columns:1fr 1fr;gap:12px}label:has([name=guests]),form:not(.request-form)>button{grid-column:1/-1}.request-form{grid-template-columns:1fr}.search-amenities{gap:7px;padding-top:14px}.search-amenities label{padding:8px 10px;font-size:11px}}
    @container(max-width:700px){form:not(.request-form){grid-template-columns:1fr 1fr}form:not(.request-form)>button,label:has([name=guests]){grid-column:1/-1}}
    @container(max-width:460px){.request-form{grid-template-columns:1fr;padding:18px}.calendar{padding:12px}.calendar-grid{gap:3px}.calendar-grid small{font-size:9px}.summary div{grid-template-columns:72px minmax(0,1fr);gap:8px}.search-amenities{gap:7px}.search-amenities label{padding:8px 9px;font-size:11px}}
    @media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;transition:none!important}}
    .booking-quote{margin-top:18px;padding-top:18px;border-top:1px solid var(--dk-line)}.booking-quote .price{margin:0;font-size:30px;line-height:1.2;font-weight:750;letter-spacing:-.8px;font-variant-numeric:tabular-nums}.booking-quote .price small{display:block;margin-top:5px;color:var(--dk-muted);font-size:12px;letter-spacing:0;font-weight:400}.booking-quote .price-placeholder{font-size:14px;letter-spacing:0;font-weight:400;color:var(--dk-muted)}.booking-quote .breakdown{margin:12px 0 0;font-size:11px;color:var(--dk-muted);line-height:1.7}.booking-quote .breakdown:empty{display:none}.booking-quote [data-domkazan-action-for] button{width:100%;margin:16px 0 0!important;padding:12px 16px!important;border-radius:10px!important;font:600 14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important}
    .request-options{grid-column:1/-1;border:1px solid var(--dk-line);border-radius:10px;padding:0 13px}.request-options summary{min-height:44px;padding:12px 0;color:var(--dk-muted);font-size:12px;font-weight:500;cursor:pointer}.request-options summary:focus-visible{outline:3px solid var(--dk-accent);outline-offset:3px}.request-options>div{display:grid;gap:14px;padding:4px 0 16px}.consent-copy{min-width:0}.consent-copy a{display:inline}
  `;

  const money = (amount) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(Number(amount));

  function field(form, title, name, type) {
    const label = document.createElement("label");
    label.textContent = title;
    const input = document.createElement("input");
    input.name = name;
    input.type = type;
    if (name==='clientName') input.autocomplete='name';
    if (name==='clientPhone') {input.autocomplete='tel';input.inputMode='tel';}
    input.required = true;
    if (type === "number") { input.min = "1"; input.max = "50"; input.value = "2"; }
    label.append(input);
    form.append(label);
  }

  function collectCards(explicitCards) {
    const items = explicitCards || Array.from(document.querySelectorAll("[data-domkazan-house]"))
      .map((element) => ({ slug: element.getAttribute("data-domkazan-house"), element, priceElement: element.querySelector("[data-domkazan-price]") }));
    const seen = new Set();
    return items.map(({ slug, element, priceElement, actionElement }) => {
      if (!slug || !element || seen.has(slug)) throw new Error("Каждая карточка должна иметь уникальный data-domkazan-house.");
      seen.add(slug);
      return {
        slug, element, priceElement, actionElement,
        originalDisplay: element.style.getPropertyValue("display"),
        originalPriority: element.style.getPropertyPriority("display"),
        originalPrice: priceElement ? priceElement.textContent : null,
        originalPriceNodes: priceElement ? [...priceElement.childNodes].map(node => node.cloneNode(true)) : [],
      };
    });
  }

  function show(card) {
    if (card.originalDisplay) card.element.style.setProperty("display", card.originalDisplay, card.originalPriority);
    else card.element.style.removeProperty("display");
  }

  function hide(card) { card.element.style.setProperty("display", "none", "important"); }

  function mount({ root, apiUrl, requestUrl, privacyUrl, cards: explicitCards, getFilters,
    initialValues = {}, getViewState, transformHouses, onResults, onInvalidate, renderPrice, testMode = false,
    calendarUrl, houseSlug, resultsUrl, ownerContacts, showCount = true, quietSuccess = false, resultElement, onSearchComplete }) {
    if (!root || !apiUrl) throw new Error("Укажите root и apiUrl для DomKazanCalendar.");
    if (root.closest("a,button")) throw new Error("Форма поиска должна находиться вне ссылки или кнопки.");
    instances.get(root)?.destroy();
    let cards = collectCards(explicitCards);
    const shadow = root.shadowRoot || root.attachShadow({ mode: "open" });
    shadow.replaceChildren();
    const style = document.createElement("style");
    style.textContent = css;
    const form = document.createElement("form");
    const dayDetails = new Map();
    let calendarLoad;
    let calendarTimer;
    let calendarGeneration = 0;
    let destroyed = false;
    const picker = rangeCalendar(form, () => form.dispatchEvent(new Event("input", { bubbles:true })),
      calendarUrl ? { getDay: day => dayDetails.get(day), onMonth: loadCalendar } : {});
    field(form, "Гостей", "guests", "number");
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    for (const name of ["checkIn", "checkOut", "guests"]) {
      if (initialValues[name]) form.elements[name].value = String(initialValues[name]);
    }
    picker.refresh();
    const button = document.createElement("button");
    button.type = "submit";
    button.textContent = houseSlug ? "Проверить стоимость" : "Показать свободные дома";
    form.append(button);
    const message = document.createElement("p");
    message.className = "message";
    message.setAttribute("role", "status");
    const requestForm = document.createElement("form");
    requestForm.className = "request-form";
    requestForm.hidden = true;
    requestForm.setAttribute("aria-label", "Заявка на проживание");
    const heading = document.createElement("h2");
    heading.textContent = "Заявка на проживание";
    heading.className = "wide";
    requestForm.append(heading);
    const summary = document.createElement("dl"); summary.className = "summary"; requestForm.append(summary);
    field(requestForm, "Имя", "clientName", "text");
    field(requestForm, "Телефон", "clientPhone", "tel");
    const messengerLabel = document.createElement("label");
    messengerLabel.textContent = "Мессенджер (по желанию)";
    const messenger = document.createElement("select");
    messenger.name = "messenger";
    for (const [value, title] of [["", "Не указан"], ["TELEGRAM", "Telegram"], ["WHATSAPP", "WhatsApp"]]) {
      const option = document.createElement("option"); option.value = value; option.textContent = title; messenger.append(option);
    }
    messengerLabel.append(messenger); requestForm.append(messengerLabel);
    field(requestForm, "Контакт мессенджера", "messengerContact", "text");
    requestForm.querySelector('[name="messengerContact"]').required = false;
    const commentLabel = document.createElement("label"); commentLabel.textContent = "Комментарий (по желанию)";
    commentLabel.className = "wide";
    const comment = document.createElement("textarea"); comment.name = "comment"; comment.maxLength = 2000;
    commentLabel.append(comment); requestForm.append(commentLabel);
    const requestOptions=document.createElement('details');requestOptions.className='request-options';
    const optionsTitle=document.createElement('summary');optionsTitle.textContent='Мессенджер и комментарий · необязательно';
    const optionalFields=document.createElement('div');optionalFields.append(messengerLabel,requestForm.elements.messengerContact.parentElement,commentLabel);
    requestOptions.append(optionsTitle,optionalFields);requestForm.append(requestOptions);
    const trap = document.createElement("label"); trap.className = "honeypot"; trap.setAttribute("aria-hidden", "true");
    trap.textContent = "Веб-сайт"; const website = document.createElement("input"); website.name = "website"; website.tabIndex = -1;
    website.autocomplete = "off"; trap.append(website); requestForm.append(trap);
    const consentLabel = document.createElement("label"); consentLabel.className = "wide consent";
    const consent = document.createElement("input"); consent.name = "consent"; consent.type = "checkbox"; consent.required = true;
    const consentCopy=document.createElement('span');consentCopy.className='consent-copy';consentCopy.textContent='Согласен на обработку персональных данных. ';
    consentLabel.append(consent,consentCopy);
    let policy = null;
    try {
      const configured = new URL(privacyUrl || root.getAttribute("data-privacy-url"));
      if (configured.protocol === "https:") policy = configured.href;
    } catch { /* A policy URL must be configured before accepting applications. */ }
    if (policy) { const link = document.createElement("a"); link.href = policy; link.target = "_blank"; link.rel = "noopener noreferrer";
      link.textContent = "Политика обработки данных"; consentCopy.append(link); }
    requestForm.append(consentLabel);
    const send = document.createElement("button"); send.type = "submit"; send.textContent = "Отправить заявку"; requestForm.append(send);
    const requestMessage = document.createElement("p"); requestMessage.className = "message wide";
    requestMessage.setAttribute("role", "status"); requestForm.append(requestMessage);
    const contacts = document.createElement("div"); contacts.className = "contacts"; contacts.hidden = true;
    const receipt = document.createElement("section"); receipt.hidden = true; receipt.className = "receipt"; receipt.setAttribute("role", "status");
    const receiptText = document.createElement("p"); receipt.append(receiptText, contacts);
    shadow.append(style, form, message, ...(resultElement?[resultElement]:[]), requestForm, receipt);
    let selectedHouse = null;
    let submissionKey = null;
    let successfulSearch = null;
    let generation = 0;
    let searchController = null;
    let searchTimer = null;
    let sending = false;
    let currentHouses = [];
    let retryPayload = null;

    async function loadCalendar(month) {
      calendarLoad?.abort();clearTimeout(calendarTimer); calendarLoad = new AbortController();
      calendarTimer=setTimeout(()=>calendarLoad?.abort(),10000);
      const token = ++calendarGeneration;
      try {
        const url = new URL(calendarUrl, apiUrl); url.searchParams.set("month", month);
        const response = await fetch(url, { signal: calendarLoad.signal, method:"GET" });
        const data = await response.json();
        if (destroyed || token !== calendarGeneration) return;
        if (!response.ok || !Array.isArray(data.days)) throw new Error("Календарь недоступен.");
        for (const day of data.days) dayDetails.set(day.date, day);
        picker.refresh();
      } catch {
        if (!destroyed && token === calendarGeneration) {message.dataset.state='error';message.textContent = "Календарь временно недоступен. Неизвестные даты нельзя выбрать. Попробуйте открыть календарь ещё раз.";}
      }finally{if(token===calendarGeneration)clearTimeout(calendarTimer);}
    }

    function parameters() {
      const params = new URLSearchParams();
      for (const [key, value] of new FormData(form)) params.set(key, String(value));
      if (getFilters) for (const [key, value] of Object.entries(getFilters())) {
        // Filters may not replace the dates or guest count selected in this form.
        if (["checkIn", "checkOut", "guests"].includes(key)) continue;
        if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
      }
      if (houseSlug) params.set("house", houseSlug);
      params.sort();
      return params;
    }

    function isCurrent(snapshot) {
      try { return snapshot && snapshot === successfulSearch && snapshot.signature === signature(); }
      catch { return false; }
    }

    function signature() { return `${parameters()}|${JSON.stringify(getViewState?.() ?? null)}`; }

    function clearActions() { for (const card of cards) card.action?.remove(); }
    function openRequest(house, snapshot) {
      if (sending) { message.textContent = "Дождитесь результата отправки заявки."; return; }
      if(retryPayload&&selectedHouse){requestForm.scrollIntoView?.({behavior:'auto',block:'start'});send.focus({preventScroll:true});requestMessage.textContent='Сначала повторите отправку сохранённой заявки. Повторная попытка не создаст дубликат.';return;}
      if (!isCurrent(snapshot)) { invalidate(); return; }
      if (!policy) { message.textContent = "Форма заявки пока недоступна: не настроена политика обработки данных."; return; }
      selectedHouse = { house, snapshot };
      submissionKey = window.crypto.randomUUID();
      retryPayload = null;
      delete requestForm.dataset.submitted;
      for (const input of requestForm.querySelectorAll('input,select,textarea')) input.disabled=false;
      send.hidden=false; requestMessage.hidden=false;
      send.textContent='Отправить заявку';
      heading.textContent = "Заявка на проживание";
      summary.replaceChildren();
      for (const [label, value] of [["Дом", house.name], ["Заезд", dateLabel(snapshot.checkIn)], ["Выезд", dateLabel(snapshot.checkOut)], ["Гостей", snapshot.guests], ["Стоимость", `${money(house.quote.total)} ₽`]]) {
        const row = document.createElement("div"); const name = document.createElement("dt"); name.textContent = `${label}:`;
        const description = document.createElement("dd"); description.textContent = value; row.append(name, description); summary.append(row);
      }
      requestMessage.textContent = `Стоимость по поиску: ${money(house.quote.total)} ₽. Итог будет проверен сервером.`;
      receipt.hidden = true; contacts.hidden = true; contacts.replaceChildren(); requestForm.hidden = false;
      if (testMode) {
        requestForm.elements.clientName.value = 'Тестовый Гость';
        requestForm.elements.clientPhone.value = '+70000000000';
      }
      // This scroll follows an explicit request action. Without it the one
      // shared form can open above a long catalog, outside the user's viewport.
      requestForm.scrollIntoView?.({behavior:'auto',block:'start'});
      requestForm.querySelector('[name="clientName"]').focus({preventScroll:true});
    }

    requestForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (sending) return;
      if (!selectedHouse || !submissionKey || !isCurrent(selectedHouse.snapshot)) { invalidate(); return; }
      const { house, snapshot } = selectedHouse;
      const sentKey = submissionKey;
      sending = true;
      send.disabled = true; requestMessage.textContent = "Отправляем заявку…";
      const values = new FormData(requestForm);
      const payload = retryPayload || { houseId: house.id, checkIn: snapshot.checkIn,
        checkOut: snapshot.checkOut, guestCount: Number(snapshot.guests),
        clientName: String(values.get("clientName")), clientPhone: String(values.get("clientPhone")),
        messenger: values.get("messenger") || null, messengerContact: values.get("messengerContact") || null,
        comment: values.get("comment") || null, consent: values.has("consent"),
        website: values.get("website") || "", idempotencyKey: sentKey, privacyPolicyUrl: policy };
      retryPayload = payload;
      // After an uncertain network outcome a retry must keep exactly this payload.
      for(const input of requestForm.querySelectorAll('input,select,textarea'))input.disabled=true;
      requestForm.setAttribute('aria-busy','true');
      const submissionController=new AbortController();
      const submissionTimer=setTimeout(()=>submissionController.abort(),15000);
      let responseStatus=0;
      try {
        const response = await fetch(requestUrl || new URL("/api/requests", apiUrl).toString(), {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
          signal:submissionController.signal,
        });
        responseStatus=response.status;
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Заявку не удалось отправить.");
        if (destroyed)return;
        if (!isCurrent(snapshot)){message.textContent=`Заявка ${data.requestId} получена для прежних параметров. Для новых дат выполните поиск заново.`;return;}
        // Retain the filled, read-only form: replacing it with a short receipt
        // would shrink the document and jump the mobile viewport upward.
        requestForm.dataset.submitted='true';
        for(const card of cards)if(card.slug===house.slug&&card.action){const action=card.action.querySelector('button');action.disabled=true;action.textContent='Заявка отправлена';action.setAttribute('aria-label',`Заявка отправлена: ${house.name}`);}
        for (const input of requestForm.querySelectorAll('input,select,textarea')) input.disabled=true;
        send.hidden=true; requestMessage.hidden=true; heading.textContent='Заявка отправлена';
        requestForm.append(receipt);
        selectedHouse = null; submissionKey = null; retryPayload = null;
        const serverTotal=/^\d+(?:\.\d{1,2})?$/.test(String(data.total))&&Number.isFinite(Number(data.total))?String(data.total):null;
        if(serverTotal!==null)summary.lastElementChild.querySelector('dd').textContent=`${money(serverTotal)} ₽`;
        const priceNotice=serverTotal===null?'':`${Number(serverTotal)!==Number(house.quote.total)?'Цена обновилась. ':''}Стоимость заявки по актуальным тарифам: ${money(serverTotal)} ₽. `;
        receiptText.textContent = `Заявка ${data.requestId}: ${house.name}, ${dateLabel(snapshot.checkIn)} — ${dateLabel(snapshot.checkOut)}. ${priceNotice}${data.message}`;
        receipt.hidden = false;
        contacts.replaceChildren();
        for (const [name, title, prefix] of [["phone", "Позвонить", "tel:"], ["telegram", "Telegram", "https://t.me/"], ["whatsapp", "WhatsApp", "https://wa.me/"]]) {
          const href = data.contacts?.[name] || ownerContacts?.[name];
          if (typeof href !== "string" || !href.startsWith(prefix)) continue;
          const link = document.createElement("a"); link.href = href; link.textContent = title;
          link.target = name === "phone" ? "" : "_blank"; link.rel = "noopener noreferrer"; contacts.append(link);
        }
        contacts.hidden = contacts.childElementCount === 0;
        receipt.querySelector(".return-link")?.remove();
        const returnLink = document.createElement("a"); returnLink.textContent = "Вернуться к результатам"; returnLink.className = "return-link";
        if (resultsUrl) returnLink.href = typeof resultsUrl === "function" ? resultsUrl() : resultsUrl;
        else { returnLink.href = "#"; returnLink.addEventListener("click", event => { event.preventDefault(); receipt.hidden = true; }); }
        receipt.append(returnLink);
      } catch (error) {
        if(destroyed)return;
        if(responseStatus===409){invalidate(false);message.dataset.state='error';message.textContent='Доступность дома изменилась. Повторите поиск перед новой заявкой.';}
        else if (isCurrent(snapshot)) {
          if(responseStatus>=400&&responseStatus<500){retryPayload=null;submissionKey=window.crypto.randomUUID();for(const input of requestForm.querySelectorAll('input,select,textarea'))input.disabled=false;requestMessage.textContent=error.message||'Проверьте данные заявки.';}
          else {send.textContent='Повторить эту же заявку';requestMessage.textContent='Не удалось получить подтверждение отправки. Повторите эту же заявку: повторная попытка не создаст дубликат. Данные сохранены.';}
        }
        else message.textContent = "Проверьте результат отправки заявки перед повторной попыткой. Для новых параметров повторите поиск.";
      }
      finally { clearTimeout(submissionTimer);requestForm.setAttribute('aria-busy','false');sending = false; send.disabled = requestForm.dataset.submitted === 'true'; }
    });

    function invalidate(showMessage = true) {
      generation++; searchController?.abort(); searchController = null; clearTimeout(searchTimer); searchTimer = null; button.disabled = false;form.setAttribute('aria-busy','false');
      successfulSearch = null;
      currentHouses = [];
      clearActions(); requestForm.hidden = true; requestForm.reset(); contacts.hidden = true; contacts.replaceChildren(); receipt.hidden = true;
      selectedHouse = null; submissionKey = null; retryPayload = null;
      delete requestForm.dataset.submitted;
      for (const input of requestForm.querySelectorAll('input,select,textarea')) input.disabled=false;
      send.hidden=false; send.disabled=sending; requestMessage.hidden=false;
      send.textContent='Отправить заявку';
      for (const card of cards) {
        show(card);
        if (card.priceElement) card.priceElement.replaceChildren(...card.originalPriceNodes.map(node => node.cloneNode(true)));
      }
      message.textContent = showMessage ? "Параметры изменились. Повторите поиск." : "";
      message.dataset.state=showMessage?'stale':'idle';
      onInvalidate?.(Object.fromEntries(new FormData(form)));
    }

    function reset() { invalidate(false); }
    form.addEventListener("input", () => { invalidate(); picker.refresh(); });
    form.addEventListener("change", () => { invalidate(); picker.refresh(); });
    function filtersChanged(event) {
      if (!getFilters || event.composedPath().includes(root) || !successfulSearch) return;
      if (!isCurrent(successfulSearch)) invalidate();
    }
    document.addEventListener("input", filtersChanged);
    document.addEventListener("change", filtersChanged);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      invalidate(false);
      if (!cards.length) { message.dataset.state='error';message.textContent = "Каталог ещё не готов к поиску. Дождитесь загрузки и проверки карточек.";onSearchComplete?.(); return; }
      const values = parameters();
      if (!validDate(values.get("checkIn")) || !validDate(values.get("checkOut")) || values.get("checkIn") < today || values.get("checkOut") <= values.get("checkIn") ||
          (Date.parse(values.get("checkOut")) - Date.parse(values.get("checkIn"))) / DAY > 60 || !/^([1-9]|[1-4][0-9]|50)$/.test(values.get("guests"))) {
        message.dataset.state='error';message.textContent = "Выберите период от 1 до 60 ночей и укажите от 1 до 50 гостей.";onSearchComplete?.(); return;
      }
      const currentGeneration = generation;
      searchController = new AbortController();
      searchTimer = setTimeout(()=>searchController?.abort(),10000);
      button.disabled = true;
      form.setAttribute('aria-busy','true');message.dataset.state='loading';
      message.textContent = "Проверяем занятость…";
      try {
        const url = new URL(apiUrl);
        const params = parameters();
        const snapshot = Object.freeze({ signature: signature(), checkIn: params.get("checkIn"),
          checkOut: params.get("checkOut"), guests: params.get("guests") });
        for (const [key, value] of params) url.searchParams.set(key, value);
        const response = await fetch(url.toString(), { method: "GET", signal: searchController.signal });
        const data = await response.json();
        if (generation !== currentGeneration) return;
        if (snapshot.signature !== signature()) { invalidate(); return; }
        if (!response.ok || !Array.isArray(data.houses)) throw new Error(data.error || "Поиск временно недоступен.");
        currentHouses = transformHouses ? transformHouses(data.houses) : data.houses;
        const available = new Map(currentHouses.map((house) => [house.slug, house]));
        successfulSearch = snapshot;
        clearActions(); requestForm.hidden = true; contacts.hidden = true;
        for (const card of cards) {
          const house = available.get(card.slug);
          if (!house) { hide(card); continue; }
          show(card);
          if (card.priceElement) {
            if (renderPrice) renderPrice(card.priceElement, house);
            else card.priceElement.textContent = `${money(house.quote.total)} ₽ за ${house.quote.nights} ноч.`;
          }
          const action = document.createElement("button"); action.type = "button"; action.textContent = "Оставить заявку";
          action.setAttribute("aria-label", `Оставить заявку: ${house.name}`);
          // The action lives outside the card's links, including fully linked cards.
          const actionHost = document.createElement("div");
          actionHost.setAttribute("data-domkazan-action-for", card.slug);
          action.style.cssText = "padding:12px 18px;border:0;border-radius:8px;background:var(--dk-accent,#176348);color:white;font:inherit;cursor:pointer;margin:8px 0";
          action.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); openRequest(house, snapshot); });
          action.addEventListener("pointerdown", (event) => event.stopPropagation());
          actionHost.append(action);
          if (card.actionElement) {
            if (card.actionElement.closest("a,button") || card.actionElement === card.element) {
              throw new Error("Контейнер кнопки заявки должен находиться вне ссылок и кнопок; используйте отдельную область некликабельной обёртки.");
            }
            card.actionElement.append(actionHost);
          } else (card.element.closest("a,button") || card.element).after(actionHost);
          card.action = actionHost;
        }
        message.dataset.state='success';
        message.textContent = quietSuccess ? '' : showCount ? `Свободных домов: ${cards.filter((card) => available.has(card.slug)).length}` :
          currentHouses.length ? "Дом свободен. Стоимость рассчитана сервером." : "Дом недоступен по выбранным датам или условиям. Измените параметры.";
        onResults?.(currentHouses, snapshot);
      } catch (error) {
        if (generation !== currentGeneration) return;
        successfulSearch = null; clearActions();
        message.dataset.state='error';message.textContent = error?.name === "AbortError" ? "Сервер не ответил вовремя. Повторите поиск." : error instanceof Error ? error.message : "Поиск временно недоступен.";
      } finally { if (generation === currentGeneration) { clearTimeout(searchTimer); searchTimer=null; button.disabled = false;form.setAttribute('aria-busy','false');onSearchComplete?.(); } }
    });
    const controller = { reset, invalidate: () => invalidate(), search: () => {if(!form.checkValidity())return false;form.requestSubmit();return true;}, values:()=>Object.fromEntries(new FormData(form)),
      request(slug) {
        const house = currentHouses.find(item => item.slug === slug);
        if (house) openRequest(house, successfulSearch);
      }, updateCards(nextCards) {
      // Tilda replaces cards after filters/pagination. Never retain an application
      // or a pending search tied to the previous catalog DOM.
      invalidate(Boolean(successfulSearch || button.disabled));
      cards = collectCards(nextCards);
    }, destroy() {
      destroyed = true; calendarGeneration++; calendarLoad?.abort();clearTimeout(calendarTimer); picker.destroy();
      reset(); document.removeEventListener("input", filtersChanged); document.removeEventListener("change", filtersChanged);
      shadow.replaceChildren(); instances.delete(root);
    } };
    instances.set(root, controller);
    if (calendarUrl) loadCalendar((initialValues.checkIn || today).slice(0,7));
    return controller;
  }

  window.DomKazanCalendar = { mount };
  function autoMount() {
    document.querySelectorAll("[data-domkazan-search]").forEach((root) => {
      const apiUrl = root.getAttribute("data-api-url");
      if (apiUrl) mount({ root, apiUrl });
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", autoMount, { once: true });
  else autoMount();
})();
