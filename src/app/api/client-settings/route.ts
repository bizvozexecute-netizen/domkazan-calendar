import { NextRequest, NextResponse } from "next/server";
import { readClientUi } from "@/lib/client-ui-store";
import { CLIENT_UI_DEFAULTS } from "@/lib/client-ui";

export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const headers = {"Cache-Control": "no-store", Vary: "Origin",
    ...(process.env.TILDA_ORIGIN && request.headers.get("origin") === process.env.TILDA_ORIGIN ? {"Access-Control-Allow-Origin": process.env.TILDA_ORIGIN} : {})};
  try { return NextResponse.json((await readClientUi()).settings, {headers}); }
  catch { return NextResponse.json(CLIENT_UI_DEFAULTS, {headers}); }
}
