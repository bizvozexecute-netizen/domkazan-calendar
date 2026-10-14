import { NextRequest, NextResponse } from "next/server";
import { allowLoginAttempt, clearAccountThrottle, createAdminSession, sessionCookieOptions, SESSION_COOKIE, verifyAdminPassword } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin !== request.nextUrl.origin) return new NextResponse(null, { status: 403 });
  const data = await request.formData();
  const email = String(data.get("email") ?? "").trim().toLowerCase();
  const password = String(data.get("password") ?? "");
  const expectedEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!await allowLoginAttempt()) {
    return NextResponse.json({ error: "Слишком много попыток. Повторите позже." }, { status: 429, headers: { "Retry-After": "900" } });
  }
  if (!expectedEmail || email.length > 320 || password.length > 1024 || !verifyAdminPassword(password) || email !== expectedEmail) {
    return NextResponse.redirect(new URL("/admin/login?error=1", request.url), 303);
  }
  await clearAccountThrottle();
  const response = NextResponse.redirect(new URL("/admin", request.url), 303);
  response.cookies.set(SESSION_COOKIE, await createAdminSession(email), sessionCookieOptions);
  return response;
}
