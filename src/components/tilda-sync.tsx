"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function TildaSync() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function sync() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/tilda/sync", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessage(data.created ? `Добавлено домов: ${data.created}. Задайте тарифы, проверьте вместимость и включите их в поиске.` : "Все дома из Tilda уже добавлены. Ваши тарифы, даты и правки сохранены.");
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Не удалось получить каталог."); }
    finally { setBusy(false); }
  }
  return <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-600">Добавили объект в каталог Tilda? Загрузите его сюда, затем задайте цены и занятость.</p><button type="button" disabled={busy} onClick={sync} className="rounded-lg border px-4 py-2 text-sm font-medium text-emerald-900 disabled:opacity-50">{busy ? "Проверяем Tilda…" : "Добавить новые дома из Tilda"}</button></div>
    <p className="mt-2 text-sm" role="status">{message}</p>
  </div>;
}
