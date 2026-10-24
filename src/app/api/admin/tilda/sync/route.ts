import { NextRequest, NextResponse } from "next/server";
import { checkAdminApiAccess } from "@/lib/admin-api";
import { db } from "@/lib/db";
import { loadCatalog } from "../../../../../../ops/tilda-test-gateway/lib/catalog.js";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const denied = await checkAdminApiAccess(request);
  if (denied) return denied;
  try {
    const catalog = await loadCatalog();
    const result = await db.house.createMany({ skipDuplicates: true, data: catalog.products.map((product: {
      slug: string; productUid: string; name: string; maxGuests: number | null; bedrooms: number | null; amenities: string[];
    }) => ({
      id: product.slug, slug: product.slug, tildaProductUid: product.productUid, name: product.name,
      maxGuests: product.maxGuests ?? 1, bedrooms: product.bedrooms, amenities: product.amenities,
      isActive: false,
    })) });
    return NextResponse.json({ created: result.count, total: catalog.products.length }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Каталог Tilda недоступен. Попробуйте позже." }, { status: 503 });
  }
}
