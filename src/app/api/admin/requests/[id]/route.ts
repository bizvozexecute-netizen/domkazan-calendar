import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { BookingStatus } from "../../../../../../generated/prisma/client";
import { checkAdminApiAccess } from "@/lib/admin-api";
import { adminErrorResponse, readJson } from "@/lib/admin-response";
import { changeBookingStatus } from "@/lib/booking-admin";

export const runtime = "nodejs";
const schema = z.strictObject({ status: z.enum(BookingStatus), paymentAcknowledged: z.boolean().optional() });

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const denied = await checkAdminApiAccess(request);
  if (denied) return denied;
  try {
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) return NextResponse.json({ error: "Некорректный статус заявки." }, { status: 400 });
    const { id } = await context.params;
    const changed = await changeBookingStatus(id, parsed.data.status, parsed.data.paymentAcknowledged);
    return NextResponse.json({ id: changed.id, status: changed.status }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return adminErrorResponse(error); }
}
