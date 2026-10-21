import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { findAvailableHouses } from "@/lib/availability";
import { nightsBetween, parseDateOnly, todayInMoscow } from "@/lib/dates";

export const runtime = "nodejs";

const querySchema = z.object({
  checkIn: z.string(),
  checkOut: z.string(),
  guests: z.coerce.number().int().min(1).max(50),
  district: z.string().trim().max(100).optional(),
  bedrooms: z.coerce.number().int().min(1).max(30).optional(),
  amenities: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
  petsAllowed: z.boolean().optional(),
  house: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120).optional(),
});

function corsHeaders(request: NextRequest): Record<string, string> {
  const allowed = process.env.TILDA_ORIGIN;
  const origin = request.headers.get("origin");
  return allowed && origin === allowed
    ? { "Access-Control-Allow-Origin": allowed, "Access-Control-Allow-Methods": "GET, OPTIONS", "Vary": "Origin" }
    : {};
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const parsed = querySchema.safeParse({
    checkIn: params.get("checkIn"),
    checkOut: params.get("checkOut"),
    guests: params.get("guests"),
    district: params.get("district") || undefined,
    bedrooms: params.get("bedrooms") || undefined,
    amenities: params.get("amenities")?.split(",").filter(Boolean),
    petsAllowed: params.get("petsAllowed") === "true" ? true : undefined,
    house: params.get("house") || undefined,
  });
  const headers = corsHeaders(request);
  if (!parsed.success) {
    return NextResponse.json({ error: "Укажите даты заезда и выезда и количество гостей." }, { status: 400, headers });
  }
  const checkIn = parseDateOnly(parsed.data.checkIn);
  const checkOut = parseDateOnly(parsed.data.checkOut);
  const nights = checkIn && checkOut ? nightsBetween(checkIn, checkOut) : 0;
  if (!checkIn || !checkOut || nights < 1 || nights > 60 || checkIn < todayInMoscow()) {
    return NextResponse.json({ error: "Проверьте даты поездки (от 1 до 60 ночей, начиная с сегодня)." }, { status: 400, headers });
  }

  try {
    const started = performance.now();
    const houses = await findAvailableHouses(checkIn, checkOut, parsed.data);
    return NextResponse.json({ checkIn: parsed.data.checkIn, checkOut: parsed.data.checkOut, guests: parsed.data.guests, houses }, { headers: {
      ...headers, "Cache-Control": "no-store", "Server-Timing": `availability;dur=${(performance.now()-started).toFixed(1)}`,
    } });
  } catch {
    return NextResponse.json({ error: "Поиск временно недоступен." }, { status: 503, headers });
  }
}
