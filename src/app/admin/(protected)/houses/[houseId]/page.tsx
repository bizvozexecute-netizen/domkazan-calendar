import { HouseEditor } from "@/components/house-editor";

export default async function EditHousePage({ params, searchParams }: {
  params: Promise<{ houseId: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { houseId } = await params;
  const { created } = await searchParams;
  return <HouseEditor houseId={houseId} initialNotice={created === "1" ? "Дом создан. Теперь можно задать базовые тарифы." : ""} />;
}
