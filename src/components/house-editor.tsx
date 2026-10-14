"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { dateKey, todayInMoscow } from "@/lib/dates";

type HouseData = { id: string; name: string; slug: string; tildaUrl: string | null; maxGuests: number;
  district: string | null; bedrooms: number | null; bathrooms: number | null; amenities: string[];
  petsAllowed: boolean | null; isActive: boolean; revision: number };
type HouseDraft = { name: string; slug: string; tildaUrl: string; maxGuests: string; district: string;
  bedrooms: string; bathrooms: string; amenities: string; petsAllowed: boolean; isActive: boolean };
type Rate = { id: string; startsOn: string; endsOn: string; weekdayPrice: string; fridayPrice: string;
  saturdayPrice: string; sundayPrice: string; minNights: number };
type RateDraft = { id: string | null; startsOn: string; lastDay: string; weekdayPrice: string;
  fridayPrice: string; saturdayPrice: string; sundayPrice: string; minNights: string };

const dateOffset = (value: string, days: number) => new Date(new Date(`${value}T00:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10);
const emptyHouse: HouseDraft = { name: "", slug: "", tildaUrl: "", maxGuests: "2", district: "", bedrooms: "",
  bathrooms: "", amenities: "", petsAllowed: false, isActive: true };
const newRate = (): RateDraft => ({ id: null, startsOn: dateKey(todayInMoscow()), lastDay: dateOffset(dateKey(todayInMoscow()), 29),
  weekdayPrice: "", fridayPrice: "", saturdayPrice: "", sundayPrice: "", minNights: "1" });
const fieldClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus-visible:outline-2 focus-visible:outline-emerald-800";

function toDraft(house: HouseData): HouseDraft {
  return { name: house.name, slug: house.slug, tildaUrl: house.tildaUrl ?? "", maxGuests: String(house.maxGuests),
    district: house.district ?? "", bedrooms: house.bedrooms?.toString() ?? "", bathrooms: house.bathrooms?.toString() ?? "",
    amenities: house.amenities.join(", "), petsAllowed: house.petsAllowed ?? false, isActive: house.isActive };
}

function rateToDraft(rate: Rate): RateDraft {
  return { id: rate.id, startsOn: rate.startsOn, lastDay: dateOffset(rate.endsOn, -1),
    weekdayPrice: rate.weekdayPrice, fridayPrice: rate.fridayPrice, saturdayPrice: rate.saturdayPrice,
    sundayPrice: rate.sundayPrice, minNights: String(rate.minNights) };
}

async function responseJson(response: Response) {
  let data;
  try { data = await response.json(); }
  catch { throw new Error("Сервер вернул неожиданный ответ. Обновите страницу."); }
  if (!response.ok) throw new Error(data.error || "Не удалось сохранить изменения.");
  return data;
}

export function HouseEditor({ houseId, initialNotice = "" }: { houseId: string | null; initialNotice?: string }) {
  const router = useRouter();
  const [house, setHouse] = useState<HouseDraft>(emptyHouse);
  const [revision, setRevision] = useState(0);
  const [houseRevision, setHouseRevision] = useState(0);
  const [rates, setRates] = useState<Rate[]>([]);
  const [rate, setRate] = useState<RateDraft>(newRate);
  const [loading, setLoading] = useState(Boolean(houseId));
  const [loaded, setLoaded] = useState(!houseId);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(initialNotice);

  useEffect(() => {
    if (!houseId) return;
    const controller = new AbortController();
    async function load() {
      const [houseData, ratesData] = await Promise.all([
        fetch(`/api/admin/houses/${houseId}`, { signal: controller.signal, cache: "no-store" }).then(responseJson),
        fetch(`/api/admin/houses/${houseId}/rates`, { signal: controller.signal, cache: "no-store" }).then(responseJson),
      ]);
      if (controller.signal.aborted) return;
      setHouse(toDraft(houseData.house));
      setRates(ratesData.rates);
      setRevision(ratesData.revision);
      setHouseRevision(houseData.house.revision);
      setLoaded(true);
    }
    load().catch((error) => { if (!controller.signal.aborted) { setLoaded(false); setMessage(error instanceof Error ? error.message : "Не удалось загрузить дом."); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [houseId]);

  async function refreshRates() {
    if (!houseId) return;
    const data = await responseJson(await fetch(`/api/admin/houses/${houseId}/rates`, { cache: "no-store" }));
    setRates(data.rates);
    setRevision(data.revision);
  }

  async function saveHouse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage("");
    try {
      const payload = { name: house.name, slug: house.slug, tildaUrl: house.tildaUrl.trim() || null,
        maxGuests: Number(house.maxGuests), district: house.district.trim() || null,
        bedrooms: house.bedrooms === "" ? null : Number(house.bedrooms), bathrooms: house.bathrooms === "" ? null : Number(house.bathrooms),
        amenities: [...new Set(house.amenities.split(",").map((item) => item.trim()).filter(Boolean))],
        petsAllowed: house.petsAllowed, isActive: house.isActive, ...(houseId && { revision: houseRevision }) };
      const data = await responseJson(await fetch(houseId ? `/api/admin/houses/${houseId}` : "/api/admin/houses", {
        method: houseId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      }));
      setRevision(data.revision);
      setHouseRevision(data.revision);
      setMessage("Дом сохранён.");
      if (!houseId) { setLoading(true); router.replace(`/admin/houses/${data.id}?created=1`); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Не удалось сохранить дом."); }
    finally { setBusy(false); }
  }

  async function saveRate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!houseId) return;
    if (rate.startsOn > rate.lastDay) { setMessage("Дата окончания должна быть не раньше даты начала."); return; }
    setBusy(true); setMessage("");
    try {
      const payload = { startsOn: rate.startsOn, endsOn: dateOffset(rate.lastDay, 1),
        weekdayPrice: rate.weekdayPrice, fridayPrice: rate.fridayPrice, saturdayPrice: rate.saturdayPrice,
        sundayPrice: rate.sundayPrice, minNights: Number(rate.minNights), revision };
      const url = rate.id ? `/api/admin/houses/${houseId}/rates/${rate.id}` : `/api/admin/houses/${houseId}/rates`;
      const result = await responseJson(await fetch(url, { method: rate.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }));
      setHouseRevision(result.revision);
      try { await refreshRates(); setRate(newRate()); setMessage("Тарифный период сохранён. Ручные цены отдельных дат сохранены."); }
      catch { setMessage("Тариф сохранён, но список не обновился. Перезагрузите страницу."); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Не удалось сохранить тариф."); }
    finally { setBusy(false); }
  }

  async function removeRate(id: string) {
    if (!houseId || !window.confirm("Удалить тарифный период? Ручные цены отдельных дат останутся.")) return;
    setBusy(true); setMessage("");
    try {
      const result = await responseJson(await fetch(`/api/admin/houses/${houseId}/rates/${id}`, { method: "DELETE",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revision }) }));
      setHouseRevision(result.revision);
      try { await refreshRates(); if (rate.id === id) setRate(newRate()); setMessage("Тарифный период удалён."); }
      catch { setMessage("Тариф удалён, но список не обновился. Перезагрузите страницу."); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Не удалось удалить тариф."); }
    finally { setBusy(false); }
  }

  const updateHouseField = (name: keyof HouseDraft, value: string | boolean) => setHouse((current) => ({ ...current, [name]: value }));
  const updateRateField = (name: keyof RateDraft, value: string) => setRate((current) => ({ ...current, [name]: value }));
  return <section className="space-y-7">
    <div><Link className="text-sm text-emerald-900 underline" href="/admin/houses">← К списку домов</Link><h1 className="mt-2 text-3xl font-bold">{houseId ? "Редактирование дома" : "Новый дом"}</h1><p className="mt-2 text-slate-600">Здесь хранятся параметры поиска. Описания и фотографии редактируются на Tilda.</p></div>
    {loading && <p>Загружаем…</p>}
    {!loading && !loaded && <p className="rounded-xl bg-white p-5">Не удалось загрузить данные дома. <button type="button" onClick={() => window.location.reload()} className="text-emerald-900 underline">Повторить загрузку</button></p>}
    {!loading && loaded && <form onSubmit={saveHouse} className="space-y-5 rounded-xl bg-white p-5 shadow-sm">
      <h2 className="text-xl font-semibold">Параметры дома</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="grid gap-1 text-sm">Название *<input required maxLength={120} value={house.name} onChange={(e) => updateHouseField("name", e.target.value)} className={fieldClass} /></label>
        <label className="grid gap-1 text-sm">Код карточки Tilda *<input required pattern="[a-z0-9]+(-[a-z0-9]+)*" title="Латинские буквы, цифры и дефисы" value={house.slug} onChange={(e) => updateHouseField("slug", e.target.value.toLowerCase())} className={fieldClass} /><span className="text-xs text-slate-600">После изменения кода обновите связь карточки на Tilda.</span></label>
        <label className="grid gap-1 text-sm">Ссылка на страницу Tilda<input type="url" value={house.tildaUrl} onChange={(e) => updateHouseField("tildaUrl", e.target.value)} className={fieldClass} /></label>
        <label className="grid gap-1 text-sm">Максимум гостей *<input required type="number" min="1" max="100" value={house.maxGuests} onChange={(e) => updateHouseField("maxGuests", e.target.value)} className={fieldClass} /></label>
        <label className="grid gap-1 text-sm">Район<input maxLength={100} value={house.district} onChange={(e) => updateHouseField("district", e.target.value)} className={fieldClass} /></label>
        <label className="grid gap-1 text-sm">Спален<input type="number" min="0" max="50" value={house.bedrooms} onChange={(e) => updateHouseField("bedrooms", e.target.value)} className={fieldClass} /></label>
        <label className="grid gap-1 text-sm">Санузлов<input type="number" min="0" max="50" value={house.bathrooms} onChange={(e) => updateHouseField("bathrooms", e.target.value)} className={fieldClass} /></label>
        <label className="grid gap-1 text-sm sm:col-span-2">Удобства через запятую<input placeholder="sauna, wifi, pool" value={house.amenities} onChange={(e) => updateHouseField("amenities", e.target.value)} className={fieldClass} /></label>
      </div>
      <div className="flex flex-wrap gap-5"><label className="flex items-center gap-2"><input type="checkbox" checked={house.petsAllowed} onChange={(e) => updateHouseField("petsAllowed", e.target.checked)} /> Можно с животными</label><label className="flex items-center gap-2"><input type="checkbox" checked={house.isActive} onChange={(e) => updateHouseField("isActive", e.target.checked)} /> Дом виден в поиске</label></div>
      <button type="submit" disabled={busy} className="rounded-lg bg-emerald-800 px-5 py-2 text-white disabled:opacity-50">Сохранить дом</button>
    </form>}

    {houseId && loaded && !loading && <div className="space-y-5 rounded-xl bg-white p-5 shadow-sm">
      <div><h2 className="text-xl font-semibold">Базовые тарифы</h2><p className="mt-1 text-sm text-slate-600">Один период задаёт цены сразу на все даты диапазона. Конечная дата включена. Пересечения периодов запрещены.</p></div>
      <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b bg-slate-50"><th className="p-3">Период</th><th className="p-3">Пн–чт</th><th className="p-3">Пт</th><th className="p-3">Сб</th><th className="p-3">Вс</th><th className="p-3">Мин. ночей</th><th className="p-3">Действия</th></tr></thead><tbody>{rates.map((item) => <tr key={item.id} className="border-b"><td className="p-3 whitespace-nowrap">{item.startsOn} — {dateOffset(item.endsOn, -1)}</td><td className="p-3">{item.weekdayPrice} ₽</td><td className="p-3">{item.fridayPrice} ₽</td><td className="p-3">{item.saturdayPrice} ₽</td><td className="p-3">{item.sundayPrice} ₽</td><td className="p-3">{item.minNights}</td><td className="p-3"><div className="flex gap-2"><button type="button" onClick={() => setRate(rateToDraft(item))} className="text-emerald-900 underline">Изменить</button><button type="button" disabled={busy} onClick={() => removeRate(item.id)} className="text-rose-800 underline disabled:opacity-50">Удалить</button></div></td></tr>)}</tbody></table>{rates.length === 0 && <p className="p-4 text-slate-600">Тарифов пока нет.</p>}</div>
      <form onSubmit={saveRate} className="space-y-4 border-t pt-5"><h3 className="font-semibold">{rate.id ? "Изменить тарифный период" : "Заполнить календарь базовым тарифом"}</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="grid gap-1 text-sm">С даты *<input required type="date" min="2000-01-01" max="2100-12-31" value={rate.startsOn} onChange={(e) => updateRateField("startsOn", e.target.value)} className={fieldClass} /></label>
          <label className="grid gap-1 text-sm">По дату включительно *<input required type="date" min="2000-01-01" max="2100-12-31" value={rate.lastDay} onChange={(e) => updateRateField("lastDay", e.target.value)} className={fieldClass} /></label>
          <label className="grid gap-1 text-sm">Пн–чт, ₽ *<input required type="text" inputMode="decimal" value={rate.weekdayPrice} onChange={(e) => updateRateField("weekdayPrice", e.target.value)} className={fieldClass} /></label>
          <label className="grid gap-1 text-sm">Пятница, ₽ *<input required type="text" inputMode="decimal" value={rate.fridayPrice} onChange={(e) => updateRateField("fridayPrice", e.target.value)} className={fieldClass} /></label>
          <label className="grid gap-1 text-sm">Суббота, ₽ *<input required type="text" inputMode="decimal" value={rate.saturdayPrice} onChange={(e) => updateRateField("saturdayPrice", e.target.value)} className={fieldClass} /></label>
          <label className="grid gap-1 text-sm">Воскресенье, ₽ *<input required type="text" inputMode="decimal" value={rate.sundayPrice} onChange={(e) => updateRateField("sundayPrice", e.target.value)} className={fieldClass} /></label>
          <label className="grid gap-1 text-sm">Минимум ночей *<input required type="number" min="1" max="60" value={rate.minNights} onChange={(e) => updateRateField("minNights", e.target.value)} className={fieldClass} /></label>
        </div>
        <div className="flex flex-wrap gap-3"><button type="submit" disabled={busy} className="rounded-lg bg-emerald-800 px-5 py-2 text-white disabled:opacity-50">{rate.id ? "Сохранить тариф" : "Заполнить период"}</button>{rate.id && <button type="button" onClick={() => setRate(newRate())} className="rounded-lg border px-5 py-2">Отмена</button>}<Link className="self-center text-emerald-900 underline" href="/admin">Ручные цены и занятость в шахматке</Link></div>
      </form>
    </div>}
    <p className="min-h-6 font-medium" role="status" aria-live="polite">{busy ? "Сохраняем…" : message}</p>
  </section>;
}
