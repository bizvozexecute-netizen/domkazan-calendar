import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { privacyPolicyUrl } from "@/lib/request-security";
import { testCatalogEnabled } from "@/lib/test-catalog";
import { TestCatalog } from "@/components/test-catalog";

export const dynamic = "force-dynamic";
export default async function TestCatalogPage() {
  if (!testCatalogEnabled()) notFound();
  const hasTildaSnapshot = await db.house.count({ where: { slug: { startsWith: "tilda-" } } }) > 0;
  const houses = await db.house.findMany({ where: { slug: { startsWith: hasTildaSnapshot ? "tilda-" : "demo-house-" } },
    select: { slug: true, name: true, district: true, maxGuests: true, tildaUrl: true, isActive: true }, orderBy: { name: "asc" } });
  return <TestCatalog houses={houses} policy={privacyPolicyUrl() ?? ""} tildaSnapshot={hasTildaSnapshot} />;
}
