/* DomKazan search widget. Configure each container with data-api-url. */
(() => {
  const style = `
    :host { display:block; font: 16px Arial, sans-serif; color:#20342b; }
    *, *::before, *::after { box-sizing:border-box; }
    form { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)) auto; gap:12px; align-items:end; }
    label { display:grid; gap:6px; font-weight:600; }
    input { width:100%; padding:12px; border:1px solid #b9c9bd; border-radius:8px; font:inherit; }
    button { padding:13px 20px; border:0; border-radius:8px; background:#176348; color:white; font:inherit; cursor:pointer; }
    .results { margin-top:20px; display:grid; gap:12px; }
    .card { padding:18px; border:1px solid #dae4dc; border-radius:10px; background:white; }
    .card h3 { margin:0 0 8px; font-size:20px; }
    .card p { margin:0 0 8px; }
    .card a { color:#176348; font-weight:700; }
    .message { margin-top:14px; }
    @media (max-width:760px) { form { grid-template-columns:1fr; } }
  `;

  function addTextElement(parent, tag, text, className) {
    const element = document.createElement(tag);
    element.textContent = text;
    if (className) element.className = className;
    parent.append(element);
    return element;
  }

  function render(container) {
    const apiUrl = container.getAttribute("data-api-url");
    if (!apiUrl || !/^https?:\/\//.test(apiUrl)) return;
    const root = container.attachShadow({ mode: "open" });
    const sheet = document.createElement("style");
    sheet.textContent = style;
    root.append(sheet);
    const form = document.createElement("form");
    const fields = [
      ["Заезд", "checkIn", "date"],
      ["Выезд", "checkOut", "date"],
      ["Гостей", "guests", "number"],
    ];
    for (const [labelText, name, type] of fields) {
      const label = addTextElement(form, "label", labelText);
      const input = document.createElement("input");
      input.name = name;
      input.type = type;
      input.required = true;
      if (type === "number") { input.min = "1"; input.max = "50"; input.value = "2"; }
      label.append(input);
    }
    const button = addTextElement(form, "button", "Найти дома");
    button.type = "submit";
    const message = addTextElement(root, "p", "", "message");
    message.setAttribute("role", "status");
    const results = document.createElement("div");
    results.className = "results";
    root.append(form, results);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      results.replaceChildren();
      message.textContent = "Ищем свободные дома…";
      button.disabled = true;
      try {
        const values = new FormData(form);
        const url = new URL(apiUrl);
        for (const [key, value] of values) url.searchParams.set(key, String(value));
        const response = await fetch(url.toString(), { method: "GET" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Поиск временно недоступен.");
        message.textContent = data.houses.length ? `Найдено домов: ${data.houses.length}` : "Свободных домов не найдено.";
        for (const house of data.houses) {
          const card = document.createElement("article");
          card.className = "card";
          addTextElement(card, "h3", house.name);
          addTextElement(card, "p", `До ${house.maxGuests} гостей · ${house.quote.nights} ночей · ${house.quote.total} ₽`);
          if (house.tildaUrl) {
            const link = document.createElement("a");
            try {
              const target = new URL(house.tildaUrl);
              if (target.protocol === "https:") {
                link.href = target.href;
                link.textContent = "Подробнее на сайте";
                card.append(link);
              }
            } catch { /* Ignore an invalid external URL in catalog data. */ }
          }
          results.append(card);
        }
      } catch (error) {
        message.textContent = error instanceof Error ? error.message : "Поиск временно недоступен.";
      } finally {
        button.disabled = false;
      }
    });
  }

  document.querySelectorAll("[data-domkazan-search]").forEach(render);
})();
