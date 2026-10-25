import { readClientUi } from "@/lib/client-ui-store";
import { ClientSettingsEditor } from "@/components/client-settings-editor";
import Link from "next/link";

export const dynamic = "force-dynamic";
export default async function SettingsPage() {
  const initial = await readClientUi();
  return <section><h1 className="mb-3 text-3xl font-bold">Настройки каталога</h1><p className="mb-4 max-w-3xl text-slate-600">Небольшой набор согласованных текстов и цветов клиентского интерфейса. Изменения не редактируют страницы Tilda, цены или занятость домов.</p><p className="mb-6"><Link className="text-emerald-900 underline" href="/admin/privacy-draft">Проект политики обработки данных для согласования</Link></p><ClientSettingsEditor initial={initial}/></section>;
}
