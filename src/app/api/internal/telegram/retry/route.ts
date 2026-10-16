import { NextRequest, NextResponse } from "next/server";
import { deliverDueTelegramNotifications } from "@/lib/telegram";
import { equalSecret } from "@/lib/request-security";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const secret = process.env.TELEGRAM_RETRY_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || secret.length < 32 || !equalSecret(supplied, secret)) {
    return NextResponse.json({ error: "Доступ запрещён." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  try {
    return NextResponse.json(await deliverDueTelegramNotifications(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Повторная отправка временно недоступна." }, { status: 503 });
  }
}
