import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkAdminApiAccess } from "@/lib/admin-api";
import { adminErrorResponse, readJson } from "@/lib/admin-response";
import { saveRate } from "@/lib/admin-mutations";
import { rateSchema } from "@/lib/admin-validation";
import { db } from "@/lib/db";

export const runtime = "nodejs";
type Context = { params: Promise<{ houseId: string }> };
const createSchema = rateSchema.extend({ revision: z.number().int().min(0) });

function serializeRate(rate: Awaited<ReturnType<typeof db.baseRate.findMany>>[number]) {
  return { id: rate.id, startsOn: rate.startsOn.toISOString().slice(0, 10), endsOn: rate.endsOn.toISOString().slice(0, 10),
    weekdayPrice: rate.weekdayPrice.toString(), fridayPrice: rate.fridayPrice.toString(),
    saturdayPrice: rate.saturdayPrice.toString(), sundayPrice: rate.sundayPrice.toString(), minNights: rate.minNights };
}

export async function GET(request: NextRequest, context: Context) {
  const denied = await checkAdminApiAccess(request);
  if (denied) return denied;
  try {
    const { houseId } = await context.params;
    const house = await db.house.findUnique({ where: { id: houseId }, select: { revision: true } });
    if (!house) return NextResponse.json({ error: "Дом не найден." }, { status: 404 });
    const rates = await db.baseRate.findMany({ where: { houseId }, orderBy: { startsOn: "asc" } });
    return NextResponse.json({ revision: house.revision, rates: rates.map(serializeRate) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return adminErrorResponse(error); }
}

export async function POST(request: NextRequest, context: Context) {
  const denied = await checkAdminApiAccess(request);
  if (denied) return denied;
  try {
    const parsed = createSchema.safeParse(await readJson(request));
    if (!parsed.success) return NextResponse.json({ error: "Проверьте цены и период тарифа." }, { status: 400 });
    const { houseId } = await context.params;
    const { revision, ...fields } = parsed.data;
    const result = await saveRate(houseId, revision, fields);
    return NextResponse.json({ rate: serializeRate(result.rate), revision: result.revision }, { status: 201 });
  } catch (error) { return adminErrorResponse(error); }
}
