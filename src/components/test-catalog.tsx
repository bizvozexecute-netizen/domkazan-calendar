"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

type House = { slug: string; name: string; district: string | null; maxGuests: number; tildaUrl: string | null; isActive: boolean };
declare global {
  interface Window { DomKazanCalendar?: { mount(options: {
    root: HTMLElement; apiUrl: string; privacyUrl: string; getFilters: () => Record<string, string>;
    cards: { slug: string; element: HTMLElement; priceElement: HTMLElement; actionElement: HTMLElement }[];
  }): { destroy(): void; invalidate(): void } } }
}

export function TestCatalog({ houses, policy, tildaSnapshot }: { houses: House[]; policy: string; tildaSnapshot: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const searchRoot = useRef<HTMLDivElement>(null);
  const district = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    if (!loaded || !searchRoot.current || !window.DomKazanCalendar) return;
    const controller = window.DomKazanCalendar.mount({ root: searchRoot.current,
      apiUrl: new URL("/api/availability", window.location.origin).href, privacyUrl: policy,
      getFilters: () => ({ district: district.current?.value ?? "" }),
      cards: houses.map((house) => ({ slug: house.slug, element: document.getElementById(house.slug)!,
        priceElement: document.getElementById(`${house.slug}-price`)!, actionElement: document.getElementById(`${house.slug}-action`)! })),
    });
    return () => controller.destroy();
  }, [loaded, houses, policy]);
  return <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
    <h1 className="text-3xl font-bold">{tildaSnapshot ? "Тестовая копия каталога Tilda" : "Вымышленный каталог для тестирования"}</h1>
    <p>{tildaSnapshot
      ? "Названия, ссылки, вместимость и базовые ставки взяты из публичного каталога. Занятость здесь тестовая; доплаты, сборы и особые условия не рассчитаны. Это не предложение бронирования. В заявках используйте только вымышленные контакты."
      : "Только синтетические дома и контакты. Карточки имитируют ссылки Tilda; это не контент рабочего сайта."}</p>
    {[...new Set(houses.map((house) => house.district))].some(Boolean) && <div className="grid max-w-sm gap-2"><label htmlFor="catalog-district">Район</label><select id="catalog-district" ref={district} className="rounded-lg border bg-white p-3">
      <option value="">Все районы</option>{[...new Set(houses.map((house) => house.district))].filter(Boolean).map((value) => <option key={value} value={value!}>{value}</option>)}
    </select></div>}
    <div ref={searchRoot} />
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{houses.map((house, index) => <div key={house.slug} id={house.slug} data-domkazan-house={house.slug}>
      {index % 2 === 0 ? <a href={house.tildaUrl && tildaSnapshot ? house.tildaUrl : `#page-${house.slug}`} className="block rounded-xl border bg-white p-5">
        <h2 className="font-bold">{house.name}</h2><p>{house.district ? `${house.district} · ` : ""}{house.isActive ? `до ${house.maxGuests} гостей` : "Особые правила для взрослых и детей; автоматический расчёт недоступен"}</p><span id={`${house.slug}-price`} data-domkazan-price>Цена после поиска</span>
      </a> : <article className="rounded-xl border bg-white p-5">
        <h2 className="font-bold"><a href={house.tildaUrl && tildaSnapshot ? house.tildaUrl : `#page-${house.slug}`}>{house.name}</a></h2><p>{house.district ? `${house.district} · ` : ""}{house.isActive ? `до ${house.maxGuests} гостей` : "Особые правила для взрослых и детей; автоматический расчёт недоступен"}</p><span id={`${house.slug}-price`} data-domkazan-price>Цена после поиска</span>
      </article>}
      <div id={`${house.slug}-action`} />
    </div>)}</div>
    <Script src="/embed/domkazan-search.js" onReady={() => setLoaded(true)} />
  </main>;
}
