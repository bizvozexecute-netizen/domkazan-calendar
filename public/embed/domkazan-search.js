/* DomKazan catalog adapter. Tilda cards remain the source of catalog content. */
(() => {
  const css = `
    :host { display:block; font:16px Arial,sans-serif; color:#20342b; }
    * { box-sizing:border-box; }
    form { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)) auto; gap:12px; align-items:end; }
    .request-form { margin-top:20px; padding:16px; border:1px solid #b9c9bd; border-radius:10px; }
    .request-form[hidden], .contacts[hidden] { display:none; }
    .request-form label { font-weight:600; }
    .request-form textarea, .request-form select { width:100%; padding:12px; border:1px solid #b9c9bd; border-radius:8px; font:inherit; }
    .request-form .wide { grid-column:1 / -1; }
    .consent { display:flex; align-items:flex-start; gap:8px; }
    .consent input { width:auto; }
    .honeypot { position:absolute; left:-10000px; }
    .contacts { display:flex; flex-wrap:wrap; gap:12px; margin-top:12px; }
    label { display:grid; gap:6px; font-weight:600; }
    input { width:100%; padding:12px; border:1px solid #b9c9bd; border-radius:8px; font:inherit; }
    button { padding:13px 20px; border:0; border-radius:8px; background:#176348; color:white; font:inherit; cursor:pointer; }
    button:disabled { opacity:.6; cursor:wait; }
    .message { margin:12px 0 0; }
    @media (max-width:760px) { form { grid-template-columns:1fr; } }
  `;

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
    return items.map(({ slug, element, priceElement }) => {
      if (!slug || !element || seen.has(slug)) throw new Error("Каждая карточка должна иметь уникальный data-domkazan-house.");
      seen.add(slug);
      return {
        slug, element, priceElement,
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

  function mount({ root, apiUrl, requestUrl, privacyUrl, cards: explicitCards, getFilters }) {
    if (!root || !apiUrl) throw new Error("Укажите root и apiUrl для DomKazanCalendar.");
    const cards = collectCards(explicitCards);
    if (cards.length === 0) throw new Error("Карточки каталога не найдены.");
    const shadow = root.shadowRoot || root.attachShadow({ mode: "open" });
    shadow.replaceChildren();
    const style = document.createElement("style");
    style.textContent = css;
    const form = document.createElement("form");
    field(form, "Заезд", "checkIn", "date");
    field(form, "Выезд", "checkOut", "date");
    field(form, "Гостей", "guests", "number");
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

    function clearActions() { for (const card of cards) card.action?.remove(); }
    function openRequest(house) {
      if (!policy) { message.textContent = "Форма заявки пока недоступна: не настроена политика обработки данных."; return; }
      selectedHouse = house;
      submissionKey = window.crypto.randomUUID();
      heading.textContent = `Заявка: ${house.name}, ${form.querySelector('[name="checkIn"]').value} — ${form.querySelector('[name="checkOut"]').value}`;
      requestMessage.textContent = `Стоимость по поиску: ${house.quote.total} ₽. Итог будет проверен сервером.`;
      contacts.hidden = true; contacts.replaceChildren(); requestForm.hidden = false;
      requestForm.querySelector('[name="clientName"]').focus();
    }

    requestForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!selectedHouse || !submissionKey) return;
      send.disabled = true; requestMessage.textContent = "Отправляем заявку…";
      const values = new FormData(requestForm);
      const payload = { houseId: selectedHouse.id, checkIn: form.querySelector('[name="checkIn"]').value,
        checkOut: form.querySelector('[name="checkOut"]').value, guestCount: Number(form.querySelector('[name="guests"]').value),
        clientName: String(values.get("clientName")), clientPhone: String(values.get("clientPhone")),
        messenger: values.get("messenger") || null, messengerContact: values.get("messengerContact") || null,
        comment: values.get("comment") || null, consent: values.has("consent"),
        website: values.get("website") || "", idempotencyKey: submissionKey };
      try {
        const response = await fetch(requestUrl || new URL("/api/requests", apiUrl).toString(), {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Заявку не удалось отправить.");
        requestForm.hidden = true;
        message.textContent = `Заявка ${data.requestId} получена. ${data.message}`;
        contacts.replaceChildren();
        for (const [name, title, prefix] of [["phone", "Позвонить", "tel:"], ["telegram", "Telegram", "https://t.me/"], ["whatsapp", "WhatsApp", "https://wa.me/"]]) {
          const href = data.contacts?.[name];
          if (typeof href !== "string" || !href.startsWith(prefix)) continue;
          const link = document.createElement("a"); link.href = href; link.textContent = title;
          link.target = name === "phone" ? "" : "_blank"; link.rel = "noopener noreferrer"; contacts.append(link);
        }
        contacts.hidden = contacts.childElementCount === 0;
      } catch (error) { requestMessage.textContent = error instanceof Error ? error.message : "Заявку не удалось отправить."; }
      finally { send.disabled = false; }
    });

    function reset() {
      clearActions(); requestForm.hidden = true; contacts.hidden = true; selectedHouse = null; submissionKey = null;
      for (const card of cards) {
        show(card);
        if (card.priceElement) card.priceElement.textContent = card.originalPrice;
      }
      message.textContent = "";
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      button.disabled = true;
      message.textContent = "Проверяем занятость…";
      try {
        const url = new URL(apiUrl);
        for (const [key, value] of new FormData(form)) url.searchParams.set(key, String(value));
        if (getFilters) {
          for (const [key, value] of Object.entries(getFilters())) {
            if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
          }
        }
        const response = await fetch(url.toString(), { method: "GET" });
        const data = await response.json();
        if (!response.ok || !Array.isArray(data.houses)) throw new Error(data.error || "Поиск временно недоступен.");
        const available = new Map(data.houses.map((house) => [house.slug, house]));
        clearActions(); requestForm.hidden = true; contacts.hidden = true;
        for (const card of cards) {
          const house = available.get(card.slug);
          if (!house) { hide(card); continue; }
          show(card);
          if (card.priceElement) card.priceElement.textContent = `${house.quote.total} ₽ за ${house.quote.nights} ноч.`;
          const action = document.createElement("button"); action.type = "button"; action.textContent = "Оставить заявку";
          action.setAttribute("aria-label", `Оставить заявку: ${house.name}`);
          action.addEventListener("click", () => openRequest(house));
          card.element.append(action); card.action = action;
        }
        message.textContent = `Свободных домов: ${cards.filter((card) => available.has(card.slug)).length}`;
      } catch (error) {
        message.textContent = error instanceof Error ? error.message : "Поиск временно недоступен.";
      } finally { button.disabled = false; }
    });
    return { reset };
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
