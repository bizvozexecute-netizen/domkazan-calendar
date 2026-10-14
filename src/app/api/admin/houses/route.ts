import { NextRequest, NextResponse } from "next/server";
import { checkAdminApiAccess } from "@/lib/admin-api";
import { adminErrorResponse, readJson } from "@/lib/admin-response";
import { createHouse } from "@/lib/admin-mutations";
import { houseSchema } from "@/lib/admin-validation";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const denied = await checkAdminApiAccess(request);
  if (denied) return denied;
  try {
    const parsed = houseSchema.safeParse(await readJson(request));
    if (!parsed.success) return NextResponse.json({ error: "Проверьте поля дома." }, { status: 400 });
    const house = await createHouse(parsed.data);
    return NextResponse.json({ id: house.id, revision: house.revision }, { status: 201 });
  } catch (error) { return adminErrorResponse(error); }
}
