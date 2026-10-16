"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Status = "NEW" | "CONTACTED" | "CONFIRMED" | "DECLINED" | "CANCELLED";
type Booking = { id: string; houseId: string; house: { name: string }; checkIn: string; checkOut: string;
  guestCount: number; clientName: string; clientPhone: string | null; messenger: string | null;
  messengerContact: string | null; message: string | null; quotedTotal: string | null;
  status: Status; createdAt: string; consentAt: string | null };
type Page = { items: Booking[]; total: number; page: number; houses: { id: string; name: string }[] };
const labels: Record<Status, string> = { NEW: "Новая", CONTACTED: "Связались", CONFIRMED: "Подтверждена",
  DECLINED: "Отклонена", CANCELLED: "Отменена" };
const actions: Record<Status, Status[]> = { NEW: ["CONTACTED", "CONFIRMED", "DECLINED", "CANCELLED"],
  CONTACTED: ["CONFIRMED", "DECLINED", "CANCELLED"], CONFIRMED: ["CANCELLED"], DECLINED: [], CANCELLED: [] };

export function RequestsManager() {
  const [data, setData] = useState<Page | null>(null);
  const [houseId, setHouseId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [opened, setOpened] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const load = useCallback(async (signal?: AbortSignal) => {
    const params = new URLSearchParams({ page: String(page) });
    if (houseId) params.set("houseId", houseId);
    if (status) params.set("status", status);
    const response = await fetch(`/api/admin/requests?${params}`, { cache: "no-store", signal });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Не удалось загрузить заявки.");
    setData(body);
  }, [houseId, status, page]);
  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) load(controller.signal).catch((error) => {
        if (!controller.signal.aborted) setNotice(error.message);
      });
    });
    return () => controller.abort();
  }, [load]);

  async function changeStatus(item: Booking, target: Status) {
    const confirmation = target === "CONFIRMED"
      ? "Оплата проверена вручную? Подтверждение займёт даты в календаре."
      : target === "CANCELLED" && item.status === "CONFIRMED"
        ? "Отменить подтверждённую бронь и снова освободить даты?"
        : `Изменить статус на «${labels[target]}»?`;
    if (!window.confirm(confirmation)) return;
    setBusy(item.id); setNotice("");
    try {
      const response = await fetch(`/api/admin/requests/${encodeURIComponent(item.id)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: target, paymentAcknowledged: target === "CONFIRMED" }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Не удалось изменить статус.");
      await load(); setNotice(`Заявка переведена в статус «${labels[target]}».`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Не удалось сохранить изменение."); }
    finally { setBusy(null); }
  }

  return <section>
    <h1 className="text-3xl font-bold">Заявки</h1>
    <p className="mt-2 text-slate-600">Свяжитесь с клиентом и проверьте оплату вручную перед подтверждением.</p>
    <div className="my-6 flex flex-wrap gap-3">
      <label className="grid min-w-0 max-w-full gap-1 text-sm">Дом<select aria-label="Дом" className="min-w-0 w-full rounded-lg border bg-white px-3 py-2" value={houseId}
        onChange={(event) => { setHouseId(event.target.value); setPage(1); }}><option value="">Все дома</option>
        {data?.houses.map((house) => <option key={house.id} value={house.id}>{house.name}</option>)}</select></label>
      <label className="grid min-w-0 max-w-full gap-1 text-sm">Статус<select aria-label="Статус" className="min-w-0 w-full rounded-lg border bg-white px-3 py-2" value={status}
        onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">Все статусы</option>
        {(Object.keys(labels) as Status[]).map((key) => <option key={key} value={key}>{labels[key]}</option>)}</select></label>
    </div>
    <p className="min-h-6 text-sm font-medium" role="status" aria-live="polite">{notice}</p>
    <p className="mb-3 text-sm text-slate-600">Всего: {data?.total ?? "…"}</p>
    <div className="grid gap-4">{data?.items.map((item) => <article key={item.id} className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-lg font-semibold">{item.house.name} · {labels[item.status]}</h2>
          <p className="text-sm text-slate-600">{item.checkIn.slice(0, 10)} — {item.checkOut.slice(0, 10)} · {item.guestCount} гостей · {item.quotedTotal ?? "—"} ₽</p>
          <p className="text-sm text-slate-500">Получена {new Date(item.createdAt).toLocaleString("ru-RU")}</p></div>
        <Link className="text-sm text-emerald-800 underline" href={`/admin?month=${item.checkIn.slice(0, 7)}&house=${encodeURIComponent(item.houseId)}&from=${item.checkIn.slice(0, 10)}&to=${item.checkOut.slice(0, 10)}`}>Показать в шахматке</Link>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="rounded-lg border px-3 py-2" aria-expanded={opened === item.id}
          onClick={() => setOpened(opened === item.id ? null : item.id)}>{opened === item.id ? "Скрыть контакты" : "Открыть контакты"}</button>
        {actions[item.status].map((target) => <button key={target} type="button" disabled={busy === item.id}
          onClick={() => changeStatus(item, target)} className={`rounded-lg px-3 py-2 disabled:opacity-50 ${target === "CONFIRMED" ? "bg-emerald-800 text-white" : "border"}`}>{labels[target]}</button>)}
      </div>
      {opened === item.id && <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm">
        <p><strong>Имя:</strong> {item.clientName}</p><p><strong>Телефон:</strong> {item.clientPhone || "Не указан"}</p>
        {item.messenger && <p><strong>{item.messenger}:</strong> {item.messengerContact}</p>}
        {item.message && <p className="whitespace-pre-wrap"><strong>Комментарий:</strong> {item.message}</p>}
        <p><strong>Согласие:</strong> {item.consentAt ? "получено" : "запись создана до внедрения формы"}</p>
      </div>}
    </article>)}</div>
    {data && data.items.length === 0 && <p className="rounded-xl bg-white p-6">Заявок по этим фильтрам нет.</p>}
    {data && data.total > 50 && <div className="mt-5 flex items-center gap-4">
      <button type="button" disabled={page === 1} onClick={() => setPage(page - 1)} className="rounded-lg border px-3 py-2 disabled:opacity-50">Назад</button>
      <span>Страница {page}</span>
      <button type="button" disabled={page * 50 >= data.total} onClick={() => setPage(page + 1)} className="rounded-lg border px-3 py-2 disabled:opacity-50">Вперёд</button>
    </div>}
  </section>;
}
