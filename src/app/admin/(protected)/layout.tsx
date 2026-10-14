import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  return (
    <div className="min-h-screen">
      <header className="border-b bg-white px-6 py-4">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <Link className="text-xl font-bold" href="/admin">DomKazan Calendar</Link>
          <nav className="flex items-center gap-5 text-sm" aria-label="Администрирование">
            <Link href="/admin/houses">Дома</Link>
            <Link href="/admin/requests">Заявки</Link>
            <form action="/api/admin/logout" method="post"><button type="submit" className="text-emerald-800">Выйти</button></form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
