import { NextRequest, NextResponse } from "next/server";
import { loadCatalog } from "../../../../ops/tilda-test-gateway/lib/catalog.js";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = { "Cache-Control": "no-store", "Vary": "Origin",
    ...(origin && origin === process.env.TILDA_ORIGIN ? { "Access-Control-Allow-Origin": origin } : {}) };
  try { return NextResponse.json(await loadCatalog(), { headers }); }
  catch { return NextResponse.json({ error: "Не удалось загрузить каталог Tilda." }, { status: 503, headers }); }
}
