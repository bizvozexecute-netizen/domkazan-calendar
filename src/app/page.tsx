import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-5 px-6">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">DomKazan Calendar</p>
      <h1 className="text-4xl font-bold">Календарь домов</h1>
      <p className="text-lg text-slate-700">Служебное приложение для управления доступностью и тарифами. Основной сайт остаётся на Tilda.</p>
      <Link className="w-fit rounded-lg bg-emerald-800 px-5 py-3 text-white" href="/admin">Войти в админку</Link>
    </main>
  );
}
