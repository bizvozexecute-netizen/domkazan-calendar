import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [houseCount, newRequestCount] = await Promise.all([
    db.house.count(),
    db.bookingRequest.count({ where: { status: "NEW" } }),
  ]);
  return (
    <section className="space-y-7">
      <div><h1 className="text-3xl font-bold">Обзор</h1><p className="mt-2 text-slate-600">Ручное управление домами и заявками.</p></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link className="rounded-xl bg-white p-6 shadow-sm" href="/admin/houses"><span className="text-4xl font-bold">{houseCount}</span><p className="mt-2">Домов в каталоге</p></Link>
        <Link className="rounded-xl bg-white p-6 shadow-sm" href="/admin/requests"><span className="text-4xl font-bold">{newRequestCount}</span><p className="mt-2">Новых заявок</p></Link>
      </div>
    </section>
  );
}
