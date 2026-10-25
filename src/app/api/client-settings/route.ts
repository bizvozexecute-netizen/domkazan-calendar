import { NextRequest, NextResponse } from "next/server";
import { readClientUi } from "@/lib/client-ui-store";
import { CLIENT_UI_DEFAULTS } from "@/lib/client-ui";
import {contactOptions} from '@/lib/contact-options';

export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const headers = {"Cache-Control": "no-store", Vary: "Origin",
    ...(process.env.TILDA_ORIGIN && request.headers.get("origin") === process.env.TILDA_ORIGIN ? {"Access-Control-Allow-Origin": process.env.TILDA_ORIGIN} : {})};
  const testEnvironment = process.env.TEST_CATALOG_ENABLED === "true" || process.env.VERCEL_ENV === "preview";
  try { return NextResponse.json({...((await readClientUi()).settings),contacts:contactOptions(),testEnvironment}, {headers}); }
  catch { return NextResponse.json({...CLIENT_UI_DEFAULTS,contacts:contactOptions(),testEnvironment}, {headers}); }
}
