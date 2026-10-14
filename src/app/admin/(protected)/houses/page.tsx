import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HousesPage() {
  const houses = await db.house.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, slug: true, maxGuests: true, district: true, bedrooms: true, amenities: true, isActive: true } });
  return (
    <section>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-bold">Дома</h1><Link className="rounded-lg bg-emerald-800 px-4 py-2 text-white" href="/admin/houses/new">Добавить дом</Link></div>
      <p className="mb-6 text-slate-600">Параметры домов для поиска. Описания и фотографии редактируются на Tilda.</p>
      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full text-left"><thead className="border-b bg-slate-50"><tr><th className="p-4">Дом</th><th className="p-4">Код карточки</th><th className="p-4">Гостей</th><th className="p-4">Район</th><th className="p-4">Спален</th><th className="p-4">Удобства</th><th className="p-4">Статус</th></tr></thead>
          <tbody>{houses.map((house) => <tr className="border-b last:border-0" key={house.id}><td className="p-4"><Link className="font-semibold text-emerald-900 underline" href={`/admin/houses/${house.id}`}>{house.name}</Link></td><td className="p-4">{house.slug}</td><td className="p-4">{house.maxGuests}</td><td className="p-4">{house.district ?? "—"}</td><td className="p-4">{house.bedrooms ?? "—"}</td><td className="p-4">{house.amenities.join(", ") || "—"}</td><td className="p-4">{house.isActive ? "Активен" : "Скрыт"}</td></tr>)}</tbody>
        </table>
        {houses.length === 0 && <p className="p-6 text-slate-600">Пока нет домов. Добавьте записи в базу данных после настройки PostgreSQL.</p>}
      </div>
    </section>
  );
}
