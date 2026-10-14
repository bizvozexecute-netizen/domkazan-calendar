import { NextRequest, NextResponse } from "next/server";
import { revokeAdminSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin !== request.nextUrl.origin) return new NextResponse(null, { status: 403 });
  await revokeAdminSession(request.cookies.get(SESSION_COOKIE)?.value);
  const response = NextResponse.redirect(new URL("/admin/login", request.url), 303);
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
  return response;
}
