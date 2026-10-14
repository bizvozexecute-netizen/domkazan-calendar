/* DomKazan catalog adapter. Tilda cards remain the source of catalog content. */
(() => {
  const css = `
    :host { display:block; font:16px Arial,sans-serif; color:#20342b; }
    * { box-sizing:border-box; }
    form { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)) auto; gap:12px; align-items:end; }
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

  function mount({ root, apiUrl, cards: explicitCards, getFilters }) {
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
    shadow.append(style, form, message);

    function reset() {
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
        for (const card of cards) {
          const house = available.get(card.slug);
          if (!house) { hide(card); continue; }
          show(card);
          if (card.priceElement) card.priceElement.textContent = `${house.quote.total} ₽ за ${house.quote.nights} ноч.`;
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
