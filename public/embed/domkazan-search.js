/* DomKazan catalog adapter. Tilda cards remain the source of catalog content. */
(() => {
  const instances = new WeakMap();
  const css = `
    :host { display:block; container-type:inline-size; font:16px Arial,sans-serif; color:#1d3028; }
    * { box-sizing:border-box; }
    form { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)) auto; gap:14px; align-items:end; }
    form > * { min-width:0; }
    .request-form { grid-template-columns:repeat(2,minmax(0,1fr)); margin-top:24px; padding:24px; border:1px solid #dce6df; border-radius:16px; background:#f9fbf9; }
    .request-form[hidden], .contacts[hidden] { display:none; }
    .request-form h2 { margin:0 0 4px; font-size:23px; line-height:1.25; }
    .request-form textarea, .request-form select { width:100%; min-height:54px; padding:14px 16px; border:1px solid #d5ded7; border-radius:11px; background:#fff; font:inherit; }
    .request-form .wide { grid-column:1 / -1; }
    .consent { display:flex; align-items:flex-start; gap:8px; }
    .consent input { width:auto; min-height:auto; }
    .honeypot { position:absolute; left:-10000px; }
    .contacts { display:flex; flex-wrap:wrap; gap:12px; margin-top:12px; }
    label { display:grid; gap:8px; color:#31473b; font-size:14px; font-weight:700; }
    input { width:100%; min-height:54px; padding:14px 16px; border:1px solid #d5ded7; border-radius:11px; background:#f8faf8; color:#1d3028; font:16px Arial,sans-serif; }
    input:focus-visible, textarea:focus-visible, select:focus-visible, button:focus-visible { outline:3px solid #a9d2b7; outline-offset:2px; }
    button { min-height:54px; padding:13px 20px; border:0; border-radius:11px; background:var(--dk-accent,#1c6047); color:white; font:700 15px Arial,sans-serif; cursor:pointer; transition:filter .15s ease,transform .15s ease; }
    button:hover:not(:disabled) { filter:brightness(.92); transform:translateY(-1px); }
    button:disabled { opacity:.6; cursor:wait; }
    .message { margin:16px 0 0; color:#345747; font-size:14px; font-weight:700; line-height:1.5; }
    @media (max-width:1100px) {
      form:not(.request-form) { grid-template-columns:repeat(2,minmax(0,1fr)); }
      form:not(.request-form) > button { grid-column:1 / -1; }
    }
    @media (max-width:600px) {
      form, form:not(.request-form) { grid-template-columns:1fr; }
      form:not(.request-form) > button { grid-column:1; }
    }
    @container (max-width:700px) {
      form:not(.request-form) { grid-template-columns:repeat(2,minmax(0,1fr)); }
      form:not(.request-form) > button { grid-column:1 / -1; }
    }
    @container (max-width:460px) {
      form, form:not(.request-form), .request-form { grid-template-columns:1fr; }
      .request-form { padding:16px; }
    }
  `;

  const money = (amount) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(Number(amount));

  function field(form, title, name, type) {
    const label = document.createElement("label");
    label.textContent = title;
    const input = document.createElement("input");
    input.name = name;
    input.type = type;
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
      };
    });
  }

  function show(card) {
    if (card.originalDisplay) card.element.style.setProperty("display", card.originalDisplay, card.originalPriority);
    else card.element.style.removeProperty("display");
  }

  function hide(card) { card.element.style.setProperty("display", "none", "important"); }

  function mount({ root, apiUrl, requestUrl, privacyUrl, cards: explicitCards, getFilters,
    initialValues = {}, getViewState, transformHouses, onResults, onInvalidate, testMode = false }) {
    if (!root || !apiUrl) throw new Error("Укажите root и apiUrl для DomKazanCalendar.");
    if (root.closest("a,button")) throw new Error("Форма поиска должна находиться вне ссылки или кнопки.");
    instances.get(root)?.destroy();
    let cards = collectCards(explicitCards);
    const shadow = root.shadowRoot || root.attachShadow({ mode: "open" });
    shadow.replaceChildren();
    const style = document.createElement("style");
    style.textContent = css;
    const form = document.createElement("form");
    field(form, "Заезд", "checkIn", "date");
    field(form, "Выезд", "checkOut", "date");
    field(form, "Гостей", "guests", "number");
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    form.elements.checkIn.min = today;
    form.elements.checkOut.min = today;
    for (const name of ["checkIn", "checkOut", "guests"]) {
      if (initialValues[name]) form.elements[name].value = String(initialValues[name]);
    }
    const button = document.createElement("button");
    button.type = "submit";
    button.textContent = "Показать свободные дома";
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
    const trap = document.createElement("label"); trap.className = "honeypot"; trap.setAttribute("aria-hidden", "true");
    trap.textContent = "Веб-сайт"; const website = document.createElement("input"); website.name = "website"; website.tabIndex = -1;
    website.autocomplete = "off"; trap.append(website); requestForm.append(trap);
    const consentLabel = document.createElement("label"); consentLabel.className = "wide consent";
    const consent = document.createElement("input"); consent.name = "consent"; consent.type = "checkbox"; consent.required = true;
    consentLabel.append(consent, document.createTextNode("Согласен на обработку персональных данных"));
    let policy = null;
    try {
      const configured = new URL(privacyUrl || root.getAttribute("data-privacy-url"));
      if (configured.protocol === "https:") policy = configured.href;
    } catch { /* A policy URL must be configured before accepting applications. */ }
    if (policy) { const link = document.createElement("a"); link.href = policy; link.target = "_blank"; link.rel = "noopener noreferrer";
      link.textContent = "Политика обработки данных"; consentLabel.append(link); }
    requestForm.append(consentLabel);
    const send = document.createElement("button"); send.type = "submit"; send.textContent = "Отправить заявку"; requestForm.append(send);
    const requestMessage = document.createElement("p"); requestMessage.className = "message wide";
    requestMessage.setAttribute("role", "status"); requestForm.append(requestMessage);
    const contacts = document.createElement("div"); contacts.className = "contacts"; contacts.hidden = true;
    shadow.append(style, form, message, requestForm, contacts);
    let selectedHouse = null;
    let submissionKey = null;
    let successfulSearch = null;
    let generation = 0;
    let searchController = null;
    let sending = false;
    let currentHouses = [];

    function parameters() {
      const params = new URLSearchParams();
      for (const [key, value] of new FormData(form)) params.set(key, String(value));
      if (getFilters) for (const [key, value] of Object.entries(getFilters())) {
        // Filters may not replace the dates or guest count selected in this form.
        if (["checkIn", "checkOut", "guests"].includes(key)) continue;
        if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
      }
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
      if (!isCurrent(snapshot)) { invalidate(); return; }
      if (!policy) { message.textContent = "Форма заявки пока недоступна: не настроена политика обработки данных."; return; }
      selectedHouse = { house, snapshot };
      submissionKey = window.crypto.randomUUID();
      heading.textContent = `Заявка: ${house.name}, ${snapshot.checkIn} — ${snapshot.checkOut}, гостей: ${snapshot.guests}`;
      requestMessage.textContent = `Стоимость по поиску: ${money(house.quote.total)} ₽. Итог будет проверен сервером.`;
      contacts.hidden = true; contacts.replaceChildren(); requestForm.hidden = false;
      if (testMode) {
        requestForm.elements.clientName.value = 'Тестовый Гость';
        requestForm.elements.clientPhone.value = '+70000000000';
      }
      requestForm.querySelector('[name="clientName"]').focus();
      requestForm.scrollIntoView?.({ behavior: "smooth", block: "center" });
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
      const payload = { houseId: house.id, checkIn: snapshot.checkIn,
        checkOut: snapshot.checkOut, guestCount: Number(snapshot.guests),
        clientName: String(values.get("clientName")), clientPhone: String(values.get("clientPhone")),
        messenger: values.get("messenger") || null, messengerContact: values.get("messengerContact") || null,
        comment: values.get("comment") || null, consent: values.has("consent"),
        website: values.get("website") || "", idempotencyKey: sentKey, privacyPolicyUrl: policy };
      try {
        const response = await fetch(requestUrl || new URL("/api/requests", apiUrl).toString(), {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Заявку не удалось отправить.");
        requestForm.hidden = true;
        selectedHouse = null; submissionKey = null; requestForm.reset();
        message.textContent = `Заявка ${data.requestId}: ${house.name}, ${snapshot.checkIn} — ${snapshot.checkOut}. ${data.message}`;
        contacts.replaceChildren();
        for (const [name, title, prefix] of [["phone", "Позвонить", "tel:"], ["telegram", "Telegram", "https://t.me/"], ["whatsapp", "WhatsApp", "https://wa.me/"]]) {
          const href = data.contacts?.[name];
          if (typeof href !== "string" || !href.startsWith(prefix)) continue;
          const link = document.createElement("a"); link.href = href; link.textContent = title;
          link.target = name === "phone" ? "" : "_blank"; link.rel = "noopener noreferrer"; contacts.append(link);
        }
        contacts.hidden = contacts.childElementCount === 0;
      } catch (error) {
        if (isCurrent(snapshot)) requestMessage.textContent = error instanceof Error ? error.message : "Заявку не удалось отправить.";
        else message.textContent = "Проверьте результат отправки заявки перед повторной попыткой. Для новых параметров повторите поиск.";
      }
      finally { sending = false; send.disabled = false; }
    });

    function invalidate(showMessage = true) {
      generation++; searchController?.abort(); searchController = null; button.disabled = false;
      successfulSearch = null;
      currentHouses = [];
      clearActions(); requestForm.hidden = true; requestForm.reset(); contacts.hidden = true; contacts.replaceChildren();
      selectedHouse = null; submissionKey = null;
      for (const card of cards) {
        show(card);
        if (card.priceElement) card.priceElement.textContent = card.originalPrice;
      }
      message.textContent = showMessage ? "Параметры изменились. Повторите поиск." : "";
      onInvalidate?.(Object.fromEntries(new FormData(form)));
    }

    function reset() { invalidate(false); }
    form.addEventListener("input", () => invalidate());
    form.addEventListener("change", () => invalidate());
    function filtersChanged(event) {
      if (!getFilters || event.composedPath().includes(root) || !successfulSearch) return;
      if (!isCurrent(successfulSearch)) invalidate();
    }
    document.addEventListener("input", filtersChanged);
    document.addEventListener("change", filtersChanged);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      invalidate(false);
      if (!cards.length) { message.textContent = "Каталог ещё не готов к поиску. Дождитесь загрузки и проверки карточек."; return; }
      const currentGeneration = generation;
      searchController = new AbortController();
      button.disabled = true;
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
          if (card.priceElement) card.priceElement.textContent = `${money(house.quote.total)} ₽ за ${house.quote.nights} ноч.`;
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
        message.textContent = `Свободных домов: ${cards.filter((card) => available.has(card.slug)).length}`;
        onResults?.(currentHouses, snapshot);
      } catch (error) {
        if (generation !== currentGeneration) return;
        successfulSearch = null; clearActions();
        message.textContent = error instanceof Error ? error.message : "Поиск временно недоступен.";
      } finally { if (generation === currentGeneration) button.disabled = false; }
    });
    const controller = { reset, invalidate: () => invalidate(), search: () => form.requestSubmit(),
      request(slug) {
        const house = currentHouses.find(item => item.slug === slug);
        if (house) openRequest(house, successfulSearch);
      }, updateCards(nextCards) {
      // Tilda replaces cards after filters/pagination. Never retain an application
      // or a pending search tied to the previous catalog DOM.
      invalidate(Boolean(successfulSearch || button.disabled));
      cards = collectCards(nextCards);
    }, destroy() {
      reset(); document.removeEventListener("input", filtersChanged); document.removeEventListener("change", filtersChanged);
      shadow.replaceChildren(); instances.delete(root);
    } };
    instances.set(root, controller);
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
