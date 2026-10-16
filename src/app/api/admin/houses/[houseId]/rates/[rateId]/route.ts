import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkAdminApiAccess } from "@/lib/admin-api";
import { adminErrorResponse, readJson } from "@/lib/admin-response";
import { deleteRate, saveRate } from "@/lib/admin-mutations";
import { rateSchema } from "@/lib/admin-validation";

export const runtime = "nodejs";
type Context = { params: Promise<{ houseId: string; rateId: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  const denied = await checkAdminApiAccess(request);
  if (denied) return denied;
  try {
    const parsed = rateSchema.extend({ revision: z.number().int().min(0) }).safeParse(await readJson(request));
    if (!parsed.success) return NextResponse.json({ error: "Проверьте цены и период тарифа." }, { status: 400 });
    const { houseId, rateId } = await context.params;
    const { revision, ...fields } = parsed.data;
    const result = await saveRate(houseId, revision, fields, rateId);
    return NextResponse.json({ id: result.rate.id, revision: result.revision });
  } catch (error) { return adminErrorResponse(error); }
}

export async function DELETE(request: NextRequest, context: Context) {
  const denied = await checkAdminApiAccess(request);
  if (denied) return denied;
  try {
    const parsed = z.object({ revision: z.number().int().min(0) }).safeParse(await readJson(request));
    if (!parsed.success) return NextResponse.json({ error: "Укажите версию записи." }, { status: 400 });
    const { houseId, rateId } = await context.params;
    const revision = await deleteRate(houseId, rateId, parsed.data.revision);
    return NextResponse.json({ revision });
  } catch (error) { return adminErrorResponse(error); }
}
