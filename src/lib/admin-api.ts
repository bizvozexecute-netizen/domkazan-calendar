import { NextRequest, NextResponse } from "next/server";
import { getAdminSessionFromToken, SESSION_COOKIE } from "@/lib/auth";

export async function checkAdminApiAccess(request: NextRequest): Promise<NextResponse | null> {
  const session = await getAdminSessionFromToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Требуется вход администратора." }, { status: 401 });
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method) && request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Недопустимый источник запроса." }, { status: 403 });
  }
  return null;
}
