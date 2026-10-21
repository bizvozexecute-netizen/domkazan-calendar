import { NextRequest, NextResponse } from "next/server";
import { getPublicHouseCalendar } from "@/lib/public-calendar";
import { monthBounds } from "@/lib/calendar-board";
import { todayInMoscow } from "@/lib/dates";

export const runtime = "nodejs";
function headers(request: NextRequest) {
  const allowed = process.env.TILDA_ORIGIN;
  return { "Cache-Control": "no-store", Vary: "Origin",
    ...(allowed && request.headers.get("origin") === allowed ? {
      "Access-Control-Allow-Origin": allowed, "Access-Control-Allow-Methods": "GET, OPTIONS",
    } : {}),
  };
}
export async function OPTIONS(request: NextRequest) { return new NextResponse(null, { status: 204, headers: headers(request) }); }
export async function GET(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const month = request.nextUrl.searchParams.get("month") || "";
  const bounds = monthBounds(month);
  const today = todayInMoscow();
  const limit = new Date(today); limit.setUTCFullYear(limit.getUTCFullYear() + 2);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 120 || !bounds ||
      bounds.end <= new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)) || bounds.start > limit) {
    return NextResponse.json({ error: "Укажите дом и месяц в пределах двух лет." }, { status: 400, headers: headers(request) });
  }
  try {
    const started = performance.now();
    const calendar = await getPublicHouseCalendar(slug, month);
    if (!calendar) return NextResponse.json({ error: "Дом не найден." }, { status: 404, headers: headers(request) });
    return NextResponse.json(calendar, { headers: { ...headers(request), "Server-Timing": `calendar;dur=${(performance.now() - started).toFixed(1)}` } });
  } catch {
    return NextResponse.json({ error: "Календарь временно недоступен." }, { status: 503, headers: headers(request) });
  }
}
