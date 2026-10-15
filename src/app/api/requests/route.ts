import { NextRequest, NextResponse } from "next/server";
import { contactOptions } from "@/lib/contact-options";
import { createCustomerRequest } from "@/lib/customer-requests";
import { CustomerRequestError, validateCustomerRequest } from "@/lib/customer-request-validation";
import { db } from "@/lib/db";
import { deliverTelegramNotification } from "@/lib/telegram";

export const runtime = "nodejs";

function corsHeaders(request: NextRequest): Record<string, string> {
  const origin = request.headers.get("origin");
  const allowed = process.env.TILDA_ORIGIN;
  return origin && allowed && origin === allowed
    ? { "Access-Control-Allow-Origin": allowed, "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type", "Vary": "Origin", "Cache-Control": "no-store" }
    : { "Cache-Control": "no-store" };
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

async function readLimitedJson(request: NextRequest): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > 8192) throw new Error("too large");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("empty body");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let body = "";
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 8192) { await reader.cancel(); throw new Error("too large"); }
    body += decoder.decode(value, { stream: true });
  }
  body += decoder.decode();
  return JSON.parse(body);
}

export async function POST(request: NextRequest) {
  const headers = corsHeaders(request);
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin && origin !== process.env.TILDA_ORIGIN) {
    return NextResponse.json({ error: "Недопустимый источник запроса." }, { status: 403, headers });
  }
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return NextResponse.json({ error: "Ожидается JSON." }, { status: 415, headers });
  }
  let raw: unknown;
  try { raw = await readLimitedJson(request); }
  catch { return NextResponse.json({ error: "Проверьте данные заявки." }, { status: 400, headers }); }
  try {
    const input = validateCustomerRequest(raw);
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const ip = forwarded && /^[0-9a-fA-F:.]{3,45}$/.test(forwarded) ? forwarded : "unknown";
    const result = await createCustomerRequest(input, ip);
    if (result.created) {
      try {
        const notification = await db.telegramNotification.findUnique({ where: { bookingRequestId: result.id }, select: { id: true } });
        if (notification) await deliverTelegramNotification(notification.id);
      } catch { /* The outbox keeps the notification for retry. */ }
    }
    return NextResponse.json({ requestId: result.id, total: result.total, currency: "RUB",
      message: "Заявка получена. Подтверждение и оплата согласуются с владельцем вручную.", contacts: contactOptions() },
    { status: result.created ? 201 : 200, headers });
  } catch (error) {
    if (error instanceof CustomerRequestError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
    return NextResponse.json({ error: "Заявку пока не удалось отправить. Попробуйте позже." }, { status: 503, headers });
  }
}
