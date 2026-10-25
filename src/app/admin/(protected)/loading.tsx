export default function AdminLoading() {
  return <section role="status" aria-live="polite" aria-busy="true" className="rounded-xl border border-slate-200 bg-white p-5">
    <p className="font-medium text-slate-800">Открываем раздел…</p>
    <p className="mt-2 text-sm text-slate-600">Загружаем актуальные данные.</p>
  </section>;
}
