import { NextResponse } from "next/server";
import { AdminConflictError, AdminInputError, AdminNotFoundError, normalizeAdminError } from "./admin-mutations";

export function adminErrorResponse(error: unknown): NextResponse {
  const normalized = normalizeAdminError(error);
  if (normalized instanceof AdminConflictError) return NextResponse.json({ error: normalized.message }, { status: 409 });
  if (normalized instanceof AdminInputError) return NextResponse.json({ error: normalized.message }, { status: 400 });
  if (normalized instanceof AdminNotFoundError) return NextResponse.json({ error: normalized.message }, { status: 404 });
  console.error("Admin operation failed", normalized);
  return NextResponse.json({ error: "Не удалось сохранить изменения. Повторите позже." }, { status: 500 });
}

export async function readJson(request: Request): Promise<unknown> {
  try { return await request.json(); }
  catch { throw new AdminInputError("Ожидается корректный JSON."); }
}
