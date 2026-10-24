/* Page-local adapter for the Tilda catalog. Only the popup class is Tilda-specific. */
(() => {
  const instances = new WeakMap();
  const selector = "[data-product-uid][data-product-url]";

  function mount({ root, catalog, mapping, apiUrl, privacyUrl, getFilters, filterRoot }) {
    if (!root || !catalog || root === catalog || catalog.contains(root)) {
      throw new Error("Разместите поиск отдельно от блока каталога.");
    }
    if (!window.DomKazanCalendar) throw new Error("Сначала загрузите domkazan-search.js.");
    const byUid = new Map();
    const slugs = new Set();
    if (!Array.isArray(mapping) || !mapping.length) throw new Error("Укажите таблицу соответствия домов.");
    for (const { productUid, houseSlug } of mapping) {
      if (typeof productUid !== "string" || !/^\d+$/.test(productUid) ||
          typeof houseSlug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(houseSlug) ||
          byUid.has(productUid) || slugs.has(houseSlug)) {
        throw new Error("UID Tilda и идентификаторы домов должны быть уникальными.");
      }
      byUid.set(productUid, houseSlug); slugs.add(houseSlug);
    }
    instances.get(root)?.destroy();
    let managed = [];
    let stopped = false;
    const controller = window.DomKazanCalendar.mount({ root, apiUrl, privacyUrl, getFilters, cards: [] });
    const notice = document.createElement("p");
    notice.setAttribute("role", "status");
    notice.textContent = "Ожидаем загрузку каталога Tilda…";
    root.shadowRoot.append(notice);

    function candidates() {
      return [...catalog.querySelectorAll(selector)].filter((element) =>
        !element.parentElement?.closest(selector) &&
        // Tilda inserts a second product node inside the same record for its popup.
        !element.classList.contains("t-store__product-popup") &&
        !element.closest(".t-store__prod-popup__container"));
    }

    function release() {
      for (const card of managed) card.slot.remove();
      managed = [];
    }

    function sync() {
      if (stopped) return;
      const elements = candidates();
      const seen = new Set();
      const valid = elements.every((element) => {
        const uid = element.getAttribute("data-product-uid");
        if (!byUid.has(uid) || seen.has(uid) || element.closest("a,button")) return false;
        seen.add(uid);
        return true;
      });
      if (valid && elements.length === managed.length && elements.every((element, index) =>
        element === managed[index].element && element.getAttribute("data-product-uid") === managed[index].uid &&
        managed[index].slot.parentElement === element)) return;
      // Reset before removing slots: restore the old catalog's display/prices.
      controller.updateCards([]);
      release();
      if (!valid) {
        notice.textContent = "Поиск приостановлен: проверьте соответствие карточек домам. Каталог доступен по прежним ссылкам.";
        return;
      }
      notice.textContent = elements.length ? "" : "Ожидаем загрузку каталога Tilda…";
      managed = elements.map((element) => {
        const uid = element.getAttribute("data-product-uid");
        const slot = document.createElement("div");
        slot.setAttribute("data-domkazan-tilda-slot", uid);
        slot.style.cssText = "padding:12px 16px;font:16px Arial,sans-serif";
        const price = document.createElement("p");
        price.textContent = "Стоимость проживания — после поиска по датам.";
        const actions = document.createElement("div");
        slot.append(price, actions);
        // A sibling of Tilda's internal links; never insert a button into an anchor.
        element.append(slot);
        return { uid, element, slot, price, actions };
      });
      controller.updateCards(managed.map(({ uid, element, price, actions }) => ({
        slug: byUid.get(uid), element, priceElement: price, actionElement: actions,
      })));
    }

    const observer = new MutationObserver(sync);
    observer.observe(catalog, { childList: true, subtree: true, attributes: true,
      attributeFilter: ["data-product-uid", "data-product-url"] });
    // Native Tilda filters may have no equivalent API filter. Any change still
    // invalidates the quote immediately, before the asynchronous catalog redraw.
    function invalidate() { controller.invalidate(); }
    const filters = new Set([catalog, filterRoot].filter(Boolean));
    for (const element of filters) {
      element.addEventListener("input", invalidate);
      element.addEventListener("change", invalidate);
    }
    const result = { invalidate, refresh: sync, destroy() {
      stopped = true; observer.disconnect();
      for (const element of filters) {
        element.removeEventListener("input", invalidate);
        element.removeEventListener("change", invalidate);
      }
      controller.destroy(); release(); notice.remove(); instances.delete(root);
    } };
    instances.set(root, result);
    sync();
    return result;
  }
  window.DomKazanTilda = { mount };
})();
