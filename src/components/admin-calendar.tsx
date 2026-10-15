"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CalendarBoardData } from "@/lib/calendar-board";
import { dateKey, parseDateOnly, todayInMoscow } from "@/lib/dates";

type Selection = { houseId: string; start: string; end: string; complete: boolean };
type Action = "close" | "open" | "setPrice" | "clearPrice";
const weekdays = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
const today = () => dateKey(todayInMoscow());
const nextDay = (day: string) => new Date(new Date(`${day}T00:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10);

function shiftedMonth(month: string, delta: number) {
  const [year, number] = month.split("-").map(Number);
  return new Date(Date.UTC(year, number - 1 + delta, 1)).toISOString().slice(0, 7);
}

async function responseJson(response: Response) {
  let data;
  try { data = await response.json(); }
  catch { throw new Error("Сервер вернул неожиданный ответ. Обновите страницу."); }
  if (!response.ok) throw new Error(data.error || "Не удалось выполнить запрос.");
  return data;
}

export function AdminCalendar({ initialMonth = "", initialHouse = "", initialFrom = "", initialTo = "" }: {
  initialMonth?: string; initialHouse?: string; initialFrom?: string; initialTo?: string;
}) {
  const [month, setMonth] = useState(() => /^\d{4}-\d{2}$/.test(initialMonth) ? initialMonth : today().slice(0, 7));
  const [board, setBoard] = useState<CalendarBoardData | null>(null);
  const [selection, setSelection] = useState<Selection | null>(() => {
    const start = parseDateOnly(initialFrom);
    const end = parseDateOnly(initialTo);
    return initialHouse && start ? { houseId: initialHouse, start: initialFrom,
      end: end && end > start ? new Date(end.getTime() - 86_400_000).toISOString().slice(0, 10) : initialFrom,
      complete: true } : null;
  });
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const scrollRegion = useRef<HTMLDivElement>(null);
  const scrollToToday = useRef(false);

  const load = useCallback(async (target: string, signal?: AbortSignal) => {
    const result = await responseJson(await fetch(`/api/admin/calendar?month=${target}`, { cache: "no-store", signal }));
    setBoard(result as CalendarBoardData);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/calendar?month=${month}`, { cache: "no-store", signal: controller.signal })
      .then(responseJson)
      .then((data) => { if (!controller.signal.aborted) setBoard(data as CalendarBoardData); })
      .catch((error) => { if (!controller.signal.aborted) {
        setBoard(null);
        setMessage(error instanceof Error ? error.message : "Не удалось загрузить календарь.");
      } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [month]);

  useEffect(() => {
    if (initialFrom && board?.month === initialFrom.slice(0, 7)) {
      scrollRegion.current?.querySelector<HTMLElement>(`[data-calendar-date="${initialFrom}"]`)?.scrollIntoView({ block: "nearest", inline: "center" });
    }
    if (scrollToToday.current && board?.month === today().slice(0, 7)) {
      scrollRegion.current?.querySelector<HTMLElement>(`[data-calendar-date="${today()}"]`)?.scrollIntoView({ block: "nearest", inline: "center" });
      scrollToToday.current = false;
    }
  }, [board, initialFrom]);

  function changeMonth(value: string) {
    if (!value || value < "2000-01" || value > "2100-12" || value === month) return;
    setLoading(true);
    setMessage("");
    setMonth(value);
  }

  function goToToday() {
    scrollToToday.current = true;
    const currentMonth = today().slice(0, 7);
    if (currentMonth === month && board?.month === month) {
      scrollRegion.current?.querySelector<HTMLElement>(`[data-calendar-date="${today()}"]`)?.scrollIntoView({ block: "nearest", inline: "center" });
      scrollToToday.current = false;
    } else changeMonth(currentMonth);
  }

  function selectCell(houseId: string, day: string) {
    setSelection((current) => !current || current.houseId !== houseId || current.complete
      ? { houseId, start: day, end: day, complete: false }
      : { houseId, start: current.start < day ? current.start : day,
        end: current.start > day ? current.start : day, complete: true });
    setMessage("");
  }

  async function apply(action: Action) {
    if (!selection || !board) return;
    if (!selection.start || !selection.end || selection.start > selection.end) { setMessage("Проверьте выбранные даты."); return; }
    if (action === "setPrice" && !/^\d{1,8}(?:\.\d{1,2})?$/.test(price)) { setMessage("Укажите цену в рублях."); return; }
    const house = board.houses.find((item) => item.id === selection.houseId);
    if (!house) { setMessage("Дом не найден. Обновите календарь."); return; }
    const labels: Record<Action, string> = { close: "Закрыть", open: "Открыть", setPrice: "Изменить цену", clearPrice: "Убрать ручную цену" };
    if (!window.confirm(`${labels[action]} даты ${selection.start} — ${selection.end} для дома «${house.name}»?`)) return;
    setBusy(true);
    setMessage("");
    let saved = false;
    try {
      await responseJson(await fetch("/api/admin/calendar", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, houseId: house.id, revision: house.revision,
          start: selection.start, end: nextDay(selection.end), ...(action === "setPrice" && { price }) }) }));
      saved = true;
      await load(month);
      setMessage("Изменения сохранены. Публичный поиск использует обновлённые данные.");
    } catch (error) {
      setMessage(saved ? "Изменения сохранены, но шахматку не удалось обновить. Перезагрузите страницу." :
        error instanceof Error ? error.message : "Не удалось сохранить изменения.");
      if (!saved) await load(month).catch(() => undefined);
    } finally { setBusy(false); }
  }

  const selectedHouse = board?.houses.find((house) => house.id === selection?.houseId);
  const buttonStyle = "rounded-lg border px-3 py-2 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800";
  return <section className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="text-3xl font-bold">Шахматка занятости</h1><p className="mt-2 text-slate-600">Выберите дом и одну дату, затем вторую для диапазона. Цена указана за ночь.</p></div>
      <Link className="rounded-lg bg-emerald-800 px-4 py-2 font-medium text-white" href="/admin/houses/new">Добавить дом</Link>
    </div>

    <div className="flex flex-wrap items-end gap-3 rounded-xl bg-white p-4 shadow-sm" aria-label="Навигация по календарю">
      <button type="button" disabled={month <= "2000-01"} onClick={() => changeMonth(shiftedMonth(month, -1))} className={`${buttonStyle} disabled:opacity-50`} aria-label="Предыдущий месяц">←</button>
      <label className="grid gap-1 text-sm font-medium">Месяц<input type="month" min="2000-01" max="2100-12" value={month} onChange={(event) => changeMonth(event.target.value)} className="rounded-lg border px-3 py-2" /></label>
      <button type="button" disabled={month >= "2100-12"} onClick={() => changeMonth(shiftedMonth(month, 1))} className={`${buttonStyle} disabled:opacity-50`} aria-label="Следующий месяц">→</button>
      <button type="button" onClick={goToToday} className={buttonStyle}>Сегодня</button>
      <span className="ml-auto text-sm text-slate-600">Зелёный — свободно · жёлтый — закрыто · красный — занято · ◇ — ручная цена</span>
    </div>

    <div className="rounded-xl bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">Действия с датами</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="grid min-w-0 gap-1 text-sm">Дом<select aria-label="Дом" value={selection?.houseId ?? ""} onChange={(event) => setSelection(event.target.value ? { houseId: event.target.value, start: today(), end: today(), complete: true } : null)} className="min-w-0 w-full rounded-lg border px-3 py-2"><option value="">Выберите дом</option>{board?.houses.map((house) => <option key={house.id} value={house.id}>{house.name}</option>)}</select></label>
        <label className="grid min-w-0 gap-1 text-sm">С даты<input type="date" min="2000-01-01" max="2100-12-31" value={selection?.start ?? ""} onChange={(event) => setSelection((current) => current && { ...current, start: event.target.value, complete: true })} className="min-w-0 w-full rounded-lg border px-3 py-2" /></label>
        <label className="grid min-w-0 gap-1 text-sm">По дату включительно<input type="date" min="2000-01-01" max="2100-12-31" value={selection?.end ?? ""} onChange={(event) => setSelection((current) => current && { ...current, end: event.target.value, complete: true })} className="min-w-0 w-full rounded-lg border px-3 py-2" /></label>
        <label className="grid min-w-0 gap-1 text-sm">Ручная цена, ₽<input type="text" inputMode="decimal" placeholder="Например, 12000" value={price} onChange={(event) => setPrice(event.target.value)} className="min-w-0 w-full rounded-lg border px-3 py-2" /></label>
        <div className="flex items-end text-sm text-slate-600">{selectedHouse ? `${selectedHouse.name}: ${selection?.start} — ${selection?.end}` : "Выберите дом и даты"}</div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={!selectedHouse || busy} onClick={() => apply("close")} className="rounded-lg bg-amber-700 px-4 py-2 text-white disabled:opacity-50">Закрыть даты</button>
        <button type="button" disabled={!selectedHouse || busy} onClick={() => apply("open")} className="rounded-lg border border-emerald-700 px-4 py-2 text-emerald-900 disabled:opacity-50">Открыть даты</button>
        <button type="button" disabled={!selectedHouse || busy} onClick={() => apply("setPrice")} className="rounded-lg bg-emerald-800 px-4 py-2 text-white disabled:opacity-50">Изменить стоимость</button>
        <button type="button" disabled={!selectedHouse || busy} onClick={() => apply("clearPrice")} className={buttonStyle}>Убрать ручную цену</button>
      </div>
      <p className="mt-3 text-sm text-slate-600">«Открыть» снимает ручное закрытие. Подтверждённые заявки по-прежнему занимают даты.</p>
      <p className="mt-2 min-h-6 text-sm font-medium" role="status" aria-live="polite">{busy ? "Сохраняем…" : message}</p>
    </div>

    <div ref={scrollRegion} className="max-h-[70vh] overflow-auto rounded-xl border bg-white shadow-sm" aria-busy={loading}>
      {loading && <p className="p-4">Загружаем календарь…</p>}
      {!loading && board?.houses.length === 0 && <p className="p-6">Домов пока нет. <Link className="underline" href="/admin/houses/new">Добавьте первый дом</Link>.</p>}
      {!loading && board && board.houses.length > 0 && <table className="border-separate border-spacing-0 text-left text-sm">
        <caption className="sr-only">Занятость и цены домов за {month}</caption>
        <thead><tr><th scope="col" className="sticky top-0 left-0 z-30 min-w-40 border-b border-r bg-slate-100 p-3 sm:min-w-56">Дом</th>{board.dates.map((day) => <th scope="col" key={day} data-calendar-date={day} className="sticky top-0 z-20 min-w-24 border-b border-r bg-slate-100 p-2 text-center font-medium"><span className="block">{day.slice(8)}</span><span className="text-slate-600">{weekdays[new Date(`${day}T00:00:00Z`).getUTCDay()]}</span></th>)}</tr></thead>
        <tbody>{board.houses.map((house) => <tr key={house.id}><th scope="row" className="sticky left-0 z-10 border-b border-r bg-white p-3 align-middle"><Link className="font-semibold text-emerald-900 underline" href={`/admin/houses/${house.id}`}>{house.name}</Link><span className="block text-xs font-normal text-slate-500">{house.isActive ? house.slug : "Отключён из поиска"}</span></th>{house.cells.map((cell) => {
          const selected = selection?.houseId === house.id && cell.date >= selection.start && cell.date <= selection.end;
          const status = cell.status === "booked" ? "Заявка подтверждена" : cell.status === "closed" ? "Закрыто" : "Свободно";
          return <td key={cell.date} className="border-b border-r p-1"><button type="button" aria-pressed={selected} aria-label={`${house.name}, ${cell.date}, ${status}, ${cell.price ? `${cell.price} рублей` : "цена не задана"}${cell.source === "manual" ? ", ручная цена" : ""}`} onClick={() => selectCell(house.id, cell.date)} className={`min-h-16 w-full rounded-lg p-2 text-center focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-900 ${selected ? "ring-2 ring-emerald-900" : ""} ${cell.status === "booked" ? "bg-rose-100 text-rose-950" : cell.status === "closed" ? "bg-amber-100 text-amber-950" : "bg-emerald-50 text-emerald-950"}`}><span className="block font-semibold">{cell.price ? `${Number(cell.price).toLocaleString("ru-RU")} ₽` : "—"}</span><span className="block text-xs">{cell.status === "booked" ? "Занято" : cell.status === "closed" ? "Закрыто" : cell.source === "manual" ? "◇ ручная" : "Свободно"}</span></button></td>;
        })}</tr>)}</tbody>
      </table>}
    </div>
  </section>;
}
