import { NextRequest } from "next/server";
import { GET as houseCalendar } from "@/app/api/houses/[slug]/calendar/route";

// Same public contract as the separate Tilda gateway, for the isolated Preview.
export const runtime = "nodejs";
export { OPTIONS } from "@/app/api/houses/[slug]/calendar/route";
export async function GET(request: NextRequest) {
  return houseCalendar(request, {
    params: Promise.resolve({ slug: request.nextUrl.searchParams.get("house") || "" }),
  });
}
