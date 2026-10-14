import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function RequestsPage() {
  const requests = await db.bookingRequest.findMany({
    take: 100,
    orderBy: { createdAt: "desc" },
    include: { house: { select: { name: true } } },
  });
  return (
    <section>
      <h1 className="mb-2 text-3xl font-bold">Заявки</h1>
      <p className="mb-6 text-slate-600">Заявки обрабатываются вручную. Статус подтверждения меняет только администратор.</p>
      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full text-left"><thead className="border-b bg-slate-50"><tr><th className="p-4">Дата</th><th className="p-4">Дом</th><th className="p-4">Клиент</th><th className="p-4">Проживание</th><th className="p-4">Статус</th></tr></thead>
          <tbody>{requests.map((request) => <tr className="border-b last:border-0" key={request.id}><td className="p-4">{request.createdAt.toLocaleDateString("ru-RU")}</td><td className="p-4">{request.house.name}</td><td className="p-4">{request.clientName}</td><td className="p-4">{request.checkIn.toISOString().slice(0, 10)} — {request.checkOut.toISOString().slice(0, 10)}</td><td className="p-4">{request.status}</td></tr>)}</tbody>
        </table>
        {requests.length === 0 && <p className="p-6 text-slate-600">Заявок пока нет.</p>}
      </div>
    </section>
  );
}
