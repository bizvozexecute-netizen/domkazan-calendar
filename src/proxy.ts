import { NextRequest, NextResponse } from "next/server";
import { checkAdminApiAccess } from "@/lib/admin-api";

export const config = { matcher: "/api/admin/:path*" };

export async function proxy(request: NextRequest) {
  if (["/api/admin/login", "/api/admin/logout"].includes(request.nextUrl.pathname)) return NextResponse.next();
  return (await checkAdminApiAccess(request)) ?? NextResponse.next();
}
