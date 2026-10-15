import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { BookingStatus } from "../../../../../generated/prisma/client";
import { checkAdminApiAccess } from "@/lib/admin-api";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const denied = await checkAdminApiAccess(request);
  if (denied) return denied;
  const query = z.object({ houseId: z.string().max(100).optional(), status: z.enum(BookingStatus).optional(),
    page: z.coerce.number().int().min(1).max(10000).default(1) }).safeParse({
    houseId: request.nextUrl.searchParams.get("houseId") || undefined,
    status: request.nextUrl.searchParams.get("status") || undefined,
    page: request.nextUrl.searchParams.get("page") || "1",
  });
  if (!query.success) return NextResponse.json({ error: "Некорректный фильтр." }, { status: 400 });
  try {
    const where = { ...(query.data.houseId && { houseId: query.data.houseId }),
      ...(query.data.status && { status: query.data.status }) };
    const [items, total, houses] = await Promise.all([
      db.bookingRequest.findMany({ where, select: {
        id: true, houseId: true, house: { select: { name: true } }, checkIn: true, checkOut: true,
        guestCount: true, clientName: true, clientPhone: true, messenger: true, messengerContact: true,
        message: true, quotedTotal: true, status: true, createdAt: true, consentAt: true,
      },
        orderBy: { createdAt: "desc" }, take: 50, skip: (query.data.page - 1) * 50 }),
      db.bookingRequest.count({ where }),
      db.house.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    ]);
    return NextResponse.json({ items, total, houses, page: query.data.page }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Не удалось загрузить заявки." }, { status: 503 }); }
}
