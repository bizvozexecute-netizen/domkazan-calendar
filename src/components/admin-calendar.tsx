"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { attachCalendarAxisLock } from "@/lib/calendar-axis-lock";
import type { CalendarBoardData } from "@/lib/calendar-board";
import { dateKey, parseDateOnly, todayInMoscow } from "@/lib/dates";

type Selection = { houseId: string; start: string; end: string; complete: boolean };
type Action = "close" | "open" | "setPrice" | "clearPrice";
type Density = "compact" | "comfortable";
const densityKey = "domkazan.calendar-density.v1";
function readDensity(): Density {
  try { return window.localStorage.getItem(densityKey) === "comfortable" ? "comfortable" : "compact"; } catch { return "compact"; }
}
function subscribeDensity(listener: () => void) {
  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
}
const defaultDensity = (): Density => "compact";
const mobileQuery = "(max-width: 760px)";
function readMobile() { return window.matchMedia?.(mobileQuery).matches ?? false; }
function subscribeMobile(listener: () => void) {
  const query = window.matchMedia?.(mobileQuery);
  query?.addEventListener("change", listener);
  return () => query?.removeEventListener("change", listener);
}
const mobileServerSnapshot = () => true;
const weekdays = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
const today = () => dateKey(todayInMoscow());
const nextDay = (day: string) => new Date(new Date(`${day}T00:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10);

function shiftedMonth(month: string, delta: number) {
  const [year, number] = month.split("-").map(Number);
  return new Date(Date.UTC(year, number - 1 + delta, 1)).toISOString().slice(0, 7);
}

function revealDate(region:HTMLDivElement|null,date:string){
  const cell=region?.querySelector<HTMLElement>(`[data-calendar-date="${date}"]`);
  if(!region||!cell)return;
  const width=region.querySelector('thead th')?.getBoundingClientRect().width||0;
  // Center inside the visible dates, excluding the sticky house column.
  const freeWidth=Math.max(0,region.clientWidth-width);
  region.scrollLeft+=cell.getBoundingClientRect().left-region.getBoundingClientRect().left-width-Math.max(0,(freeWidth-cell.getBoundingClientRect().width)/2);
}

async function responseJson(response: Response) {
  let data;
  try { data = await response.json(); }
  catch { throw new Error("Сервер вернул неожиданный ответ. Обновите страницу."); }
  if (!response.ok) throw new Error(data.error || "Не удалось выполнить запрос.");
  return data;
}

const CalendarRow = memo(function CalendarRow({ house, selection, compact, onSelect, onInspect }: {
  house: CalendarBoardData["houses"][number]; selection: Selection | null; compact: boolean;
  onSelect: (houseId: string, day: string, button: HTMLButtonElement) => void;
  onInspect: (house: CalendarBoardData["houses"][number], trigger: HTMLButtonElement) => void;
}) {
  return <tr><th scope="row" className="calendar-house-cell sticky left-0 z-10 border-b border-r bg-white align-middle">
    <button type="button" className="calendar-house-name" title={house.name} aria-label={`Полное название: ${house.name}`} onClick={event => onInspect(house,event.currentTarget)}>{house.calendarName || house.name}</button>
    {!house.isActive && <span className="calendar-inactive">Отключён</span>}
  </th>{house.cells.map(cell => {
    const selected = Boolean(selection && cell.date >= selection.start && cell.date <= selection.end);
    const status = cell.status === "booked" ? "Заявка подтверждена" : cell.status === "closed" ? "Закрыто" : "Свободно";
    const description = `${house.name}, ${cell.date}, ${status}, ${cell.price ? `${cell.price} рублей` : "цена не задана"}${cell.source === "manual" ? ", ручная цена" : ""}`;
    return <td key={cell.date} className="border-b border-r p-0"><button type="button" title={description} aria-pressed={selected} aria-label={description}
      onClick={event => onSelect(house.id, cell.date, event.currentTarget)}
      className={`calendar-price focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-900 ${cell.status === "booked" || cell.status === "closed" ? "bg-blue-600 text-white" : "bg-white text-slate-800"}`}>
      {cell.price ? Number(cell.price).toLocaleString("ru-RU", { useGrouping: !compact }) : "—"}
    </button></td>;
  })}</tr>;
});

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
  const savedDensity = useSyncExternalStore(subscribeDensity, readDensity, defaultDensity);
  const [densityChoice, setDensity] = useState<Density | null>(null);
  const mobile = useSyncExternalStore(subscribeMobile, readMobile, mobileServerSnapshot);
  const density = mobile ? "compact" : densityChoice ?? savedDensity;
  const [inspectedHouse, setInspectedHouse] = useState<CalendarBoardData["houses"][number] | null>(null);
  const houseDialog = useRef<HTMLDialogElement>(null);
  const houseDialogTrigger = useRef<HTMLButtonElement | null>(null);
  const inspectHouse = useCallback((house: CalendarBoardData["houses"][number], trigger: HTMLButtonElement) => {
    houseDialogTrigger.current = trigger;
    setInspectedHouse(house);
  }, []);
  useEffect(() => {
    if (inspectedHouse && houseDialog.current && !houseDialog.current.open) houseDialog.current.showModal();
  }, [inspectedHouse]);
  const [price, setPrice] = useState("");
  const [houseSearch, setHouseSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<{ action: Action; houseId: string; revision: number; start: string; end: string; price: string; label: string } | null>(null);
  const scrollRegion = useRef<HTMLDivElement>(null);
  useEffect(() => scrollRegion.current ? attachCalendarAxisLock(scrollRegion.current) : undefined, []);
  const scrollToToday = useRef(false);
  const initialScrollDone = useRef(false);
  const restorePosition = useRef<{ left: number; top: number } | null>(null);
  const [panel, setPanel] = useState({ left: 16, top: 100 });
  const [manualOpen,setManualOpen]=useState(false);
  const actionsRegion=useRef<HTMLDivElement>(null);
  const actionsTrigger=useRef<HTMLElement|null>(null);
  useEffect(()=>{if(manualOpen)actionsRegion.current?.querySelector('select')?.focus({preventScroll:true});},[manualOpen]);

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
      revealDate(scrollRegion.current,initialFrom);
      initialScrollDone.current = true;
    }
    if (scrollToToday.current && board?.month === today().slice(0, 7)) {
      revealDate(scrollRegion.current,today());
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
      revealDate(scrollRegion.current,today());
      scrollToToday.current = false;
    } else changeMonth(currentMonth);
  }

  const selectCell = useCallback((houseId: string, day: string, button: HTMLButtonElement) => {
    actionsTrigger.current=button;
    const box = button.getBoundingClientRect();
    setPanel({ left: Math.max(16, Math.min(box.left, window.innerWidth - 736)), top: Math.max(16, Math.min(box.bottom + 8, window.innerHeight - 340)) });
    setSelection((current) => !current || current.houseId !== houseId || current.complete
      ? { houseId, start: day, end: day, complete: false }
      : { houseId, start: current.start < day ? current.start : day,
        end: current.start > day ? current.start : day, complete: true });
    setMessage("");
  }, []);

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
  const actionsOpen=Boolean(selection||manualOpen);
  function closeActions(){setSelection(null);setManualOpen(false);setPending(null);actionsTrigger.current?.focus({preventScroll:true});}
  const visibleHouses = board?.houses.filter(house => `${house.name} ${house.calendarName || ""}`.toLocaleLowerCase("ru").includes(houseSearch.trim().toLocaleLowerCase("ru"))) ?? [];
  const priceChars = useMemo(() => Math.max(5, ...(board?.houses.flatMap(house => house.cells.map(cell => cell.price ? Number(cell.price).toLocaleString("ru-RU", { useGrouping: density !== "compact" }).length : 1)) ?? [])), [board, density]);
  function changeDensity(value: "compact" | "comfortable") {
    setDensity(value);
    try { window.localStorage.setItem(densityKey, value); } catch { /* Usable without persistent storage. */ }
  }
  const buttonStyle = "rounded-lg border px-3 py-2 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800";
  return <section className="calendar-page space-y-6">
    <div className="calendar-heading">
      <div><h1 className="text-3xl font-bold">Шахматка занятости</h1><p className="mt-2 text-slate-600">Выберите дом и одну дату, затем вторую для диапазона. Цена указана за ночь.</p></div>
      <Link className="rounded-lg border bg-white px-4 py-2 font-medium text-blue-700" href="/admin/houses/new">Добавить дом</Link>
    </div>

    <div className="calendar-tools calendar-desktop-tools" aria-label="Навигация по календарю">
      <button type="button" disabled={month <= "2000-01"} onClick={() => changeMonth(shiftedMonth(month, -1))} className={`${buttonStyle} disabled:opacity-50`} aria-label="Предыдущий месяц">←</button>
      <label className="grid gap-1 text-sm font-medium">Месяц<input type="month" min="2000-01" max="2100-12" value={month} onChange={(event) => changeMonth(event.target.value)} className="rounded-lg border px-3 py-2" /></label>
      <button type="button" disabled={month >= "2100-12"} onClick={() => changeMonth(shiftedMonth(month, 1))} className={`${buttonStyle} disabled:opacity-50`} aria-label="Следующий месяц">→</button>
      <button type="button" onClick={goToToday} className={buttonStyle}>Сегодня</button>
      <button type="button" onClick={event=>{actionsTrigger.current=event.currentTarget;setManualOpen(true);}} className={buttonStyle}>Выбрать даты вручную</button>
      <div className="calendar-legend"><span><i aria-hidden="true"/>Свободно</span><span><i className="occupied" aria-hidden="true"/>Занято / закрыто</span><span>— Нет тарифа</span></div>
    </div>

    {!actionsOpen&&message&&<p role="status" className="rounded-lg border bg-white p-3 text-sm">{message}</p>}
    <div ref={actionsRegion} hidden={!actionsOpen} role="region" aria-label="Действия с выбранными датами"
      style={{ "--panel-left": `${panel.left}px`, "--panel-top": `${panel.top}px` } as CSSProperties}
      onKeyDown={(event) => { if (event.key === "Escape" && !busy) closeActions(); }}
      className={`calendar-actions ${selection && !selection.complete && !manualOpen ? "is-selecting" : ""} fixed inset-x-0 bottom-0 z-50 max-h-[55vh] overflow-auto rounded-t-xl border bg-white p-4 shadow-xl lg:inset-x-auto lg:bottom-auto lg:left-[var(--panel-left)] lg:top-[var(--panel-top)] lg:w-[720px] lg:rounded-xl`}>
      <div className="flex items-center justify-between gap-2"><h2 className="text-base font-medium">Действия с датами</h2><button type="button" disabled={busy} onClick={closeActions} className="rounded border px-3 py-1" aria-label="Закрыть панель действий">×</button></div>
      <button type="button" className="calendar-selection-expand" onClick={() => setSelection(current => current && {...current,complete:true})}>Действия для одной даты</button>
      <div className="calendar-action-fields mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="grid min-w-0 gap-1 text-sm">Дом<select aria-label="Дом" value={selection?.houseId ?? ""} onChange={(event) => setSelection(event.target.value ? { houseId: event.target.value, start: today(), end: today(), complete: true } : null)} className="min-w-0 w-full rounded-lg border px-3 py-2"><option value="">Выберите дом</option>{board?.houses.map((house) => <option key={house.id} value={house.id}>{house.name}</option>)}</select></label>
        <label className="grid min-w-0 gap-1 text-sm">С даты<input type="date" min="2000-01-01" max="2100-12-31" value={selection?.start ?? ""} onChange={(event) => setSelection((current) => current && { ...current, start: event.target.value, complete: true })} className="min-w-0 w-full rounded-lg border px-3 py-2" /></label>
        <label className="grid min-w-0 gap-1 text-sm">По дату включительно<input type="date" min="2000-01-01" max="2100-12-31" value={selection?.end ?? ""} onChange={(event) => setSelection((current) => current && { ...current, end: event.target.value, complete: true })} className="min-w-0 w-full rounded-lg border px-3 py-2" /></label>
        <label className="grid min-w-0 gap-1 text-sm">Ручная цена, ₽<input type="text" inputMode="decimal" placeholder="Например, 12000" value={price} onChange={(event) => setPrice(event.target.value)} className="min-w-0 w-full rounded-lg border px-3 py-2" /></label>
      </div>
      <div className="mt-2 text-xs text-slate-600">{selectedHouse ? `${selectedHouse.name}: ${selection?.start} — ${selection?.end}` : "Выберите дом и даты"}</div>
      <div className="calendar-action-buttons mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={!selectedHouse || busy} onClick={() => apply("close")} className="rounded-lg bg-amber-700 px-4 py-2 text-white disabled:opacity-50">Закрыть даты</button>
        <button type="button" disabled={!selectedHouse || busy} onClick={() => apply("open")} className="rounded-lg border border-emerald-700 px-4 py-2 text-emerald-900 disabled:opacity-50">Открыть даты</button>
        <button type="button" disabled={!selectedHouse || busy} onClick={() => apply("setPrice")} className="rounded-lg bg-emerald-800 px-4 py-2 text-white disabled:opacity-50">Изменить стоимость</button>
        <button type="button" disabled={!selectedHouse || busy} onClick={() => apply("clearPrice")} className={buttonStyle}>Убрать ручную цену</button>
      </div>
      <p className="calendar-action-help mt-2 text-xs text-slate-600">«Открыть» снимает ручное закрытие. Подтверждённые заявки по-прежнему занимают даты.</p>
      <p className="mt-2 min-h-6 text-sm font-medium" role="status" aria-live="polite">{busy ? "Сохраняем…" : message}</p>
      {pending && <div role="alertdialog" aria-labelledby="calendar-confirm-label" aria-modal="false" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p id="calendar-confirm-label" className="font-medium">{pending.label}</p>
        <div className="mt-3 flex gap-3"><button type="button" onClick={confirmAction} className="rounded-lg bg-emerald-800 px-4 py-2 text-white">Подтвердить изменение</button><button type="button" onClick={() => setPending(null)} className="rounded-lg border bg-white px-4 py-2">Отмена</button></div>
      </div>}
    </div>

    <div className="calendar-card" data-density={density}>
      <div className="calendar-density" role="group" aria-label="Плотность шахматки">
        <span>Вид:</span>{([['compact','Компактный'],['comfortable','Обычный']] as const).map(([value,label]) => <button key={value} type="button" aria-pressed={density===value} onClick={() => changeDensity(value)}>{label}</button>)}
        <span className="calendar-density-help">Нажмите название дома, чтобы увидеть его полностью.</span>
      </div>
      <div className="calendar-card-header"><label className="block font-medium"><span className="calendar-search-label">Найти дом в шахматке</span><input type="search" placeholder="Найти дом" value={houseSearch} onChange={event => setHouseSearch(event.target.value)} className="w-full rounded-lg border px-3 py-2" /></label><p>{visibleHouses.length} домов · цены за ночь</p><button type="button" className={`calendar-mobile-manual ${buttonStyle}`} onClick={event=>{actionsTrigger.current=event.currentTarget;setManualOpen(true);}}>Выбрать даты</button></div>
    <div ref={scrollRegion} className="calendar-grid-scroll" role="region" aria-label="Цены и занятость домов" tabIndex={0} aria-busy={loading} style={{"--calendar-days":board?.dates.length ?? 31,"--calendar-price-ch":priceChars} as CSSProperties}>
      <div className="calendar-mobile-nav" role="group" aria-label="Навигация по месяцам">
        <button type="button" disabled={month <= "2000-01"} onClick={() => changeMonth(shiftedMonth(month, -1))} aria-label="Предыдущий месяц">←</button>
        <label><span className="sr-only">Месяц</span><input type="month" min="2000-01" max="2100-12" value={month} onChange={event => changeMonth(event.target.value)} /></label>
        <button type="button" disabled={month >= "2100-12"} onClick={() => changeMonth(shiftedMonth(month, 1))} aria-label="Следующий месяц">→</button>
        <button type="button" onClick={goToToday}>Сегодня</button>
      </div>
      {loading && <p className="p-4">Загружаем календарь…</p>}
      {!loading && board?.houses.length === 0 && <p className="p-6">Домов пока нет. <Link className="underline" href="/admin/houses/new">Добавьте первый дом</Link>.</p>}
      {!loading && board && board.houses.length > 0 && <table className="calendar-table border-separate border-spacing-0 text-left text-sm">
        <caption className="sr-only">Занятость и цены домов за {month}</caption>
        <colgroup><col className="calendar-house-col"/>{board.dates.map(day=><col key={day}/>)}</colgroup>
        <thead><tr><th scope="col" className="calendar-house-cell sticky top-0 left-0 z-30 border-b border-r bg-slate-100 font-normal">Дом</th>{board.dates.map((day) => {
          const weekDay = new Date(`${day}T00:00:00Z`).getUTCDay();
          return <th scope="col" key={day} data-calendar-date={day} data-today={day===today()?"":undefined} data-weekend={weekDay === 5 || weekDay === 6 ? "" : undefined} className="calendar-day sticky top-0 z-20 border-b border-r text-center font-normal"><span className="block">{day.slice(8)}</span><span className="text-slate-600">{weekdays[weekDay]}</span></th>;
        })}</tr></thead>
        <tbody>{visibleHouses.map(house => <CalendarRow key={house.id} house={house} compact={density === "compact"}
          selection={selection?.houseId === house.id ? selection : null} onSelect={selectCell} onInspect={inspectHouse}/>)}</tbody>
      </table>}
    </div>
    </div>
    <dialog ref={houseDialog} aria-labelledby="calendar-house-title" onClose={() => {setInspectedHouse(null);houseDialogTrigger.current?.focus({preventScroll:true});}} className="calendar-house-dialog">
      <h2 id="calendar-house-title">{inspectedHouse?.name}</h2>
      <p>{inspectedHouse?.calendarName}</p>
      <div><button type="button" onClick={() => houseDialog.current?.close()}>Закрыть название</button>
      {inspectedHouse && <Link href={`/admin/houses/${inspectedHouse.id}`}>Редактировать дом</Link>}</div>
    </dialog>
  </section>;
}
