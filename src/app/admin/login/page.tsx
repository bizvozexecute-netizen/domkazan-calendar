import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getAdminSession()) redirect("/admin");
  const { error } = await searchParams;
  return (
    <main className="admin-login flex min-h-screen items-center justify-center px-5 py-10">
      <div className="admin-login-card">
        <p className="mb-8 text-sm font-bold tracking-tight text-blue-700">DOMKAZAN <span className="ml-2 font-normal text-slate-500">Calendar</span></p>
        <h1 className="mb-2 text-3xl font-bold">Вход в админку</h1>
        <p className="mb-6 text-slate-600">Доступ только для администратора DomKazan.</p>
        {error && <p role="alert" className="mb-4 rounded bg-red-50 p-3 text-red-800">Неверный адрес или пароль.</p>}
        <form action="/api/admin/login" method="post" className="grid gap-4">
          <label className="grid gap-1">Email<input className="rounded border p-3" name="email" type="email" autoComplete="username" required /></label>
          <label className="grid gap-1">Пароль<input className="rounded border p-3" name="password" type="password" autoComplete="current-password" required /></label>
          <button className="rounded bg-emerald-800 p-3 text-white" type="submit">Войти</button>
        </form>
      </div>
    </main>
  );
}
