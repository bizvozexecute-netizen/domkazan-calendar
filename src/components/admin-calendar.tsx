"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
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
  const [houseSearch, setHouseSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<{ action: Action; houseId: string; revision: number; start: string; end: string; price: string; label: string } | null>(null);
  const scrollRegion = useRef<HTMLDivElement>(null);
  const scrollToToday = useRef(false);
  const initialScrollDone = useRef(false);
  const restorePosition = useRef<{ left: number; top: number } | null>(null);
  const [panel, setPanel] = useState({ left: 16, top: 100 });

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
    if (restorePosition.current && scrollRegion.current) {
      scrollRegion.current.scrollLeft = restorePosition.current.left;
      scrollRegion.current.scrollTop = restorePosition.current.top;
      restorePosition.current = null;
      return;
    }
    if (!initialScrollDone.current && initialFrom && board?.month === initialFrom.slice(0, 7)) {
      scrollRegion.current?.querySelector<HTMLElement>(`[data-calendar-date="${initialFrom}"]`)?.scrollIntoView({ block: "nearest", inline: "center" });
      initialScrollDone.current = true;
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

  function selectCell(houseId: string, day: string, button: HTMLButtonElement) {
    const box = button.getBoundingClientRect();
    setPanel({ left: Math.max(16, Math.min(box.left, window.innerWidth - 736)), top: Math.max(16, Math.min(box.bottom + 8, window.innerHeight - 340)) });
    setSelection((current) => !current || current.houseId !== houseId || current.complete
      ? { houseId, start: day, end: day, complete: false }
      : { houseId, start: current.start < day ? current.start : day,
        end: current.start > day ? current.start : day, complete: true });
    setMessage("");
  }

  function apply(action: Action) {
    if (!selection || !board) return;
    if (!selection.start || !selection.end || selection.start > selection.end) { setMessage("Проверьте выбранные даты."); return; }
    if (action === "setPrice" && !/^\d{1,8}(?:\.\d{1,2})?$/.test(price)) { setMessage("Укажите цену в рублях."); return; }
    const house = board.houses.find((item) => item.id === selection.houseId);
    if (!house) { setMessage("Дом не найден. Обновите календарь."); return; }
    const labels: Record<Action, string> = { close: "Закрыть", open: "Открыть", setPrice: "Изменить цену", clearPrice: "Убрать ручную цену" };
    setPending({ action, houseId: house.id, revision: house.revision, start: selection.start,
      end: nextDay(selection.end), price, label: `${labels[action]} даты ${selection.start} — ${selection.end} для дома «${house.name}»?` });
  }

  async function confirmAction() {
    if (!pending) return;
    const input = pending;
    setPending(null);
    setBusy(true);
    if (scrollRegion.current) restorePosition.current = {left:scrollRegion.current.scrollLeft,top:scrollRegion.current.scrollTop};
    setMessage("");
    let saved = false;
    try {
      await responseJson(await fetch("/api/admin/calendar", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: input.action, houseId: input.houseId, revision: input.revision,
          start: input.start, end: input.end, ...(input.action === "setPrice" && { price: input.price }) }) }));
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
  const visibleHouses = board?.houses.filter(house => `${house.name} ${house.calendarName || ""}`.toLocaleLowerCase("ru").includes(houseSearch.trim().toLocaleLowerCase("ru"))) ?? [];
  const buttonStyle = "rounded-lg border px-3 py-2 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800";
  return <section className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="text-3xl font-bold">Шахматка занятости</h1><p className="mt-2 text-slate-600">Выберите дом и одну дату, затем вторую для диапазона. Цена указана за ночь.</p></div>
      <Link className="rounded-lg bg-emerald-800 px-4 py-2 font-medium text-white" href="/admin/houses/new">Добавить дом</Link>
    </div>

    <div className="flex flex-wrap items-end gap-2 rounded-lg bg-white p-2 shadow-sm" aria-label="Навигация по календарю">
      <button type="button" disabled={month <= "2000-01"} onClick={() => changeMonth(shiftedMonth(month, -1))} className={`${buttonStyle} disabled:opacity-50`} aria-label="Предыдущий месяц">←</button>
      <label className="grid gap-1 text-sm font-medium">Месяц<input type="month" min="2000-01" max="2100-12" value={month} onChange={(event) => changeMonth(event.target.value)} className="rounded-lg border px-3 py-2" /></label>
      <button type="button" disabled={month >= "2100-12"} onClick={() => changeMonth(shiftedMonth(month, 1))} className={`${buttonStyle} disabled:opacity-50`} aria-label="Следующий месяц">→</button>
      <button type="button" onClick={goToToday} className={buttonStyle}>Сегодня</button>
      <span className="ml-auto text-xs text-slate-600">Светлый — свободно · синий — занято или закрыто · — нет тарифа</span>
    </div>

    <div role={selection ? "region" : undefined} aria-label="Действия с выбранными датами"
      style={{ "--panel-left": `${panel.left}px`, "--panel-top": `${panel.top}px` } as CSSProperties}
      onKeyDown={(event) => { if (event.key === "Escape" && !busy) setSelection(null); }}
      className={selection ? "fixed inset-x-0 bottom-0 z-50 max-h-[55vh] overflow-auto rounded-t-xl border bg-white p-3 shadow-xl lg:inset-x-auto lg:bottom-auto lg:left-[var(--panel-left)] lg:top-[var(--panel-top)] lg:w-[720px] lg:rounded-xl" : "rounded-xl bg-white p-3 shadow-sm"}>
      <div className="flex items-center justify-between gap-2"><h2 className="text-base font-medium">Действия с датами</h2>{selection && <button type="button" disabled={busy} onClick={() => setSelection(null)} className="rounded border px-3 py-1" aria-label="Закрыть панель действий">×</button>}</div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="grid min-w-0 gap-1 text-sm">Дом<select aria-label="Дом" value={selection?.houseId ?? ""} onChange={(event) => setSelection(event.target.value ? { houseId: event.target.value, start: today(), end: today(), complete: true } : null)} className="min-w-0 w-full rounded-lg border px-3 py-2"><option value="">Выберите дом</option>{board?.houses.map((house) => <option key={house.id} value={house.id}>{house.name}</option>)}</select></label>
        <label className="grid min-w-0 gap-1 text-sm">С даты<input type="date" min="2000-01-01" max="2100-12-31" value={selection?.start ?? ""} onChange={(event) => setSelection((current) => current && { ...current, start: event.target.value, complete: true })} className="min-w-0 w-full rounded-lg border px-3 py-2" /></label>
        <label className="grid min-w-0 gap-1 text-sm">По дату включительно<input type="date" min="2000-01-01" max="2100-12-31" value={selection?.end ?? ""} onChange={(event) => setSelection((current) => current && { ...current, end: event.target.value, complete: true })} className="min-w-0 w-full rounded-lg border px-3 py-2" /></label>
        <label className="grid min-w-0 gap-1 text-sm">Ручная цена, ₽<input type="text" inputMode="decimal" placeholder="Например, 12000" value={price} onChange={(event) => setPrice(event.target.value)} className="min-w-0 w-full rounded-lg border px-3 py-2" /></label>
      </div>
      <div className="mt-2 text-xs text-slate-600">{selectedHouse ? `${selectedHouse.name}: ${selection?.start} — ${selection?.end}` : "Выберите дом и даты"}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={!selectedHouse || busy} onClick={() => apply("close")} className="rounded-lg bg-amber-700 px-4 py-2 text-white disabled:opacity-50">Закрыть даты</button>
        <button type="button" disabled={!selectedHouse || busy} onClick={() => apply("open")} className="rounded-lg border border-emerald-700 px-4 py-2 text-emerald-900 disabled:opacity-50">Открыть даты</button>
        <button type="button" disabled={!selectedHouse || busy} onClick={() => apply("setPrice")} className="rounded-lg bg-emerald-800 px-4 py-2 text-white disabled:opacity-50">Изменить стоимость</button>
        <button type="button" disabled={!selectedHouse || busy} onClick={() => apply("clearPrice")} className={buttonStyle}>Убрать ручную цену</button>
      </div>
      <p className="mt-2 text-xs text-slate-600">«Открыть» снимает ручное закрытие. Подтверждённые заявки по-прежнему занимают даты.</p>
      <p className="mt-2 min-h-6 text-sm font-medium" role="status" aria-live="polite">{busy ? "Сохраняем…" : message}</p>
      {pending && <div role="alertdialog" aria-labelledby="calendar-confirm-label" aria-modal="false" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p id="calendar-confirm-label" className="font-medium">{pending.label}</p>
        <div className="mt-3 flex gap-3"><button type="button" onClick={confirmAction} className="rounded-lg bg-emerald-800 px-4 py-2 text-white">Подтвердить изменение</button><button type="button" onClick={() => setPending(null)} className="rounded-lg border bg-white px-4 py-2">Отмена</button></div>
      </div>}
    </div>

    <div ref={scrollRegion} className="max-h-[70vh] overflow-auto rounded-xl border bg-white shadow-sm" aria-busy={loading}>
      <label className="sticky left-0 block max-w-sm p-4 text-sm font-medium">Найти дом в шахматке<input type="search" placeholder="Название дома" value={houseSearch} onChange={event => setHouseSearch(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
      {loading && <p className="p-4">Загружаем календарь…</p>}
      {!loading && board?.houses.length === 0 && <p className="p-6">Домов пока нет. <Link className="underline" href="/admin/houses/new">Добавьте первый дом</Link>.</p>}
      {!loading && board && board.houses.length > 0 && <table className="border-separate border-spacing-0 text-left text-sm">
        <caption className="sr-only">Занятость и цены домов за {month}</caption>
        <thead><tr><th scope="col" className="sticky top-0 left-0 z-30 min-w-28 max-w-40 border-b border-r bg-slate-100 px-2 py-1 font-normal sm:min-w-40">Дом</th>{board.dates.map((day) => {
          const weekDay = new Date(`${day}T00:00:00Z`).getUTCDay();
          return <th scope="col" key={day} data-calendar-date={day} className={`sticky top-0 z-20 min-w-[72px] border-b border-r px-1 py-1 text-center text-xs font-normal ${weekDay === 0 || weekDay === 6 ? "bg-slate-200" : "bg-slate-50"}`}><span className="block">{day.slice(8)}</span><span className="text-slate-600">{weekdays[weekDay]}</span></th>;
        })}</tr></thead>
        <tbody>{visibleHouses.map((house) => <tr key={house.id}><th scope="row" className="sticky left-0 z-10 max-w-40 border-b border-r bg-white px-2 py-1 align-middle"><Link title={house.name} className="block max-w-36 truncate text-xs font-normal text-emerald-900 underline" href={`/admin/houses/${house.id}`}>{house.calendarName || house.name}</Link>{!house.isActive && <span className="block text-xs font-normal text-slate-500">Отключён</span>}</th>{house.cells.map((cell) => {
          const selected = selection?.houseId === house.id && cell.date >= selection.start && cell.date <= selection.end;
          const status = cell.status === "booked" ? "Заявка подтверждена" : cell.status === "closed" ? "Закрыто" : "Свободно";
          const description = `${house.name}, ${cell.date}, ${status}, ${cell.price ? `${cell.price} рублей` : "цена не задана"}${cell.source === "manual" ? ", ручная цена" : ""}`;
          return <td key={cell.date} className="border-b border-r p-0"><button type="button" title={description} aria-pressed={selected} aria-label={description} onClick={(event) => selectCell(house.id, cell.date, event.currentTarget)} className={`min-h-10 w-full whitespace-nowrap px-1 py-2 text-center text-xs font-normal focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-900 ${selected ? "ring-2 ring-inset ring-emerald-900" : ""} ${cell.status === "booked" || cell.status === "closed" ? "bg-blue-600 text-white" : "bg-white text-slate-800"}`}>{cell.price ? Number(cell.price).toLocaleString("ru-RU") : "—"}</button></td>;
        })}</tr>)}</tbody>
      </table>}
    </div>
  </section>;
}
