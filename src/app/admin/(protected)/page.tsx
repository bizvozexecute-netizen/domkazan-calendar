import { AdminCalendar } from "@/components/admin-calendar";

export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const value = (key: string) => typeof params[key] === "string" ? params[key] as string : "";
  return <AdminCalendar initialMonth={value("month")} initialHouse={value("house")} initialFrom={value("from")} initialTo={value("to")} />;
}
