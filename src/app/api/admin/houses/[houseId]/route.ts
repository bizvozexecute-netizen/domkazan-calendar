import { NextRequest, NextResponse } from "next/server";
import { checkAdminApiAccess } from "@/lib/admin-api";
import { adminErrorResponse, readJson } from "@/lib/admin-response";
import { updateHouse } from "@/lib/admin-mutations";
import { houseSchema } from "@/lib/admin-validation";
import { db } from "@/lib/db";

export const runtime = "nodejs";
type Context = { params: Promise<{ houseId: string }> };

export async function GET(request: NextRequest, context: Context) {
  const denied = await checkAdminApiAccess(request);
  if (denied) return denied;
  try {
    const { houseId } = await context.params;
    const house = await db.house.findUnique({ where: { id: houseId }, select: {
      id: true, name: true, slug: true, calendarName: true, tildaProductUid: true, tildaUrl: true, maxGuests: true, district: true,
      includedGuests: true, extraGuestPrice: true, serviceFee: true,
      bedrooms: true, bathrooms: true, amenities: true, petsAllowed: true, isActive: true, revision: true,
    } });
    return house ? NextResponse.json({ house }, { headers: { "Cache-Control": "no-store" } })
      : NextResponse.json({ error: "Дом не найден." }, { status: 404 });
  } catch (error) { return adminErrorResponse(error); }
}

export async function PATCH(request: NextRequest, context: Context) {
  const denied = await checkAdminApiAccess(request);
  if (denied) return denied;
  try {
    const body = await readJson(request) as Record<string, unknown>;
    const parsed = houseSchema.safeParse(body);
    if (!parsed.success || !Number.isInteger(body.revision) || Number(body.revision) < 0) {
      return NextResponse.json({ error: "Проверьте поля дома и версию записи." }, { status: 400 });
    }
    const { houseId } = await context.params;
    const house = await updateHouse(houseId, Number(body.revision), parsed.data);
    return NextResponse.json({ id: house.id, revision: house.revision });
  } catch (error) { return adminErrorResponse(error); }
}
