import { NextRequest, NextResponse } from "next/server";
import { revokeAdminSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { appOrigin } from "@/lib/request-security";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  let canonical: string;
  try { canonical = appOrigin(request); } catch { return new NextResponse(null, { status: 503 }); }
  if (origin !== canonical) return new NextResponse(null, { status: 403 });
  await revokeAdminSession(request.cookies.get(SESSION_COOKIE)?.value);
  const response = NextResponse.redirect(new URL("/admin/login", canonical), 303);
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
  return response;
}
