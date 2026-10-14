import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HousesPage() {
  const houses = await db.house.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, slug: true, maxGuests: true, isActive: true } });
  return (
    <section>
      <h1 className="mb-2 text-3xl font-bold">Дома</h1>
      <p className="mb-6 text-slate-600">Первоначальный просмотр каталога. Редактирование тарифов и закрытых периодов будет добавлено далее.</p>
      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full text-left"><thead className="border-b bg-slate-50"><tr><th className="p-4">Дом</th><th className="p-4">Код</th><th className="p-4">Гостей</th><th className="p-4">Статус</th></tr></thead>
          <tbody>{houses.map((house) => <tr className="border-b last:border-0" key={house.id}><td className="p-4">{house.name}</td><td className="p-4">{house.slug}</td><td className="p-4">{house.maxGuests}</td><td className="p-4">{house.isActive ? "Активен" : "Скрыт"}</td></tr>)}</tbody>
        </table>
        {houses.length === 0 && <p className="p-6 text-slate-600">Пока нет домов. Добавьте записи в базу данных после настройки PostgreSQL.</p>}
      </div>
    </section>
  );
}
