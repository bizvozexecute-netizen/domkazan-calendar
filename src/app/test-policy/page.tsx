import { notFound } from "next/navigation";
import { testCatalogEnabled } from "@/lib/test-catalog";

export const dynamic = "force-dynamic";
export default function TestPolicyPage() {
  if (!testCatalogEnabled()) notFound();
  return <main className="mx-auto max-w-3xl p-6"><h1 className="text-2xl font-bold">Политика тестового стенда</h1>
    <p className="mt-4">Это тестовый стенд с отдельной базой. Для заявки используйте только имя «Тестовый Гость» и номер +70000000000, без контакта мессенджера. Заявки записываются в тестовую базу для проверки интерфейса и могут быть удалены после тестирования.</p>
    <p className="mt-4">Эта страница не заменяет политику обработки данных действующего сайта. Перед внедрением необходимо настроить согласованный документ владельца.</p></main>;
}
