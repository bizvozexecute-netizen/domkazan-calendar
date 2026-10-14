import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkAdminApiAccess } from "@/lib/admin-api";
import { db } from "@/lib/db";
import { parseDateOnly } from "@/lib/dates";
import { assertValidRatePeriod, RateConflictError } from "@/lib/rates";

export const runtime = "nodejs";

const price = z.string().regex(/^\d{1,8}(?:\.\d{1,2})?$/);
const rateSchema = z.object({
  startsOn: z.string(),
  endsOn: z.string(),
  weekdayPrice: price,
  fridayPrice: price,
  saturdayPrice: price,
  sundayPrice: price,
  minNights: z.number().int().min(1).max(60),
});

export async function GET(request: NextRequest, context: { params: Promise<{ houseId: string }> }) {
  const denied = await checkAdminApiAccess(request);
  if (denied) return denied;
  const { houseId } = await context.params;
  const rates = await db.baseRate.findMany({ where: { houseId }, orderBy: { startsOn: "asc" } });
  return NextResponse.json({ rates: rates.map((rate) => ({
    id: rate.id,
    startsOn: rate.startsOn.toISOString().slice(0, 10),
    endsOn: rate.endsOn.toISOString().slice(0, 10),
    weekdayPrice: rate.weekdayPrice.toString(),
    fridayPrice: rate.fridayPrice.toString(),
    saturdayPrice: rate.saturdayPrice.toString(),
    sundayPrice: rate.sundayPrice.toString(),
    minNights: rate.minNights,
  })) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest, context: { params: Promise<{ houseId: string }> }) {
  const denied = await checkAdminApiAccess(request);
  if (denied) return denied;
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Ожидается JSON с данными тарифа." }, { status: 400 }); }
  const parsed = rateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Некорректные данные тарифа." }, { status: 400 });
  const startsOn = parseDateOnly(parsed.data.startsOn);
  const endsOn = parseDateOnly(parsed.data.endsOn);
  if (!startsOn || !endsOn || startsOn >= endsOn) return NextResponse.json({ error: "Некорректный период тарифа." }, { status: 400 });
  const { houseId } = await context.params;
  const house = await db.house.findUnique({ where: { id: houseId }, select: { id: true } });
  if (!house) return NextResponse.json({ error: "Дом не найден." }, { status: 404 });
  const existing = await db.baseRate.findMany({ where: { houseId, startsOn: { lt: endsOn }, endsOn: { gt: startsOn } }, select: { startsOn: true, endsOn: true } });
  try {
    assertValidRatePeriod({ startsOn, endsOn }, existing);
    const rate = await db.baseRate.create({ data: { ...parsed.data, startsOn, endsOn, houseId } });
    return NextResponse.json({ id: rate.id }, { status: 201 });
  } catch (error) {
    if (error instanceof RateConflictError || String(error).includes("BaseRate_no_overlap") || String(error).includes("23P01")) {
      return NextResponse.json({ error: "Период пересекается с существующим тарифом." }, { status: 409 });
    }
    throw error;
  }
}
