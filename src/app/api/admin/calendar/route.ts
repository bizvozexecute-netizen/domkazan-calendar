import { NextRequest, NextResponse } from "next/server";
import { checkAdminApiAccess } from "@/lib/admin-api";
import { adminErrorResponse, readJson } from "@/lib/admin-response";
import { changeCalendar } from "@/lib/admin-mutations";
import { calendarActionSchema } from "@/lib/admin-validation";
import { getCalendarBoard } from "@/lib/calendar-board";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const denied = await checkAdminApiAccess(request);
  if (denied) return denied;
  try {
    const board = await getCalendarBoard(request.nextUrl.searchParams.get("month") ?? "");
    return board ? NextResponse.json(board, { headers: { "Cache-Control": "no-store" } })
      : NextResponse.json({ error: "Укажите месяц в формате ГГГГ-ММ." }, { status: 400 });
  } catch (error) { return adminErrorResponse(error); }
}

export async function POST(request: NextRequest) {
  const denied = await checkAdminApiAccess(request);
  if (denied) return denied;
  try {
    const parsed = calendarActionSchema.safeParse(await readJson(request));
    if (!parsed.success) return NextResponse.json({ error: "Проверьте действие и выбранные даты." }, { status: 400 });
    const revision = await changeCalendar(parsed.data);
    return NextResponse.json({ revision });
  } catch (error) { return adminErrorResponse(error); }
}
