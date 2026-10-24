import { NextRequest, NextResponse } from "next/server";
import { checkAdminApiAccess } from "@/lib/admin-api";
import { adminErrorResponse } from "@/lib/admin-response";
import { AdminInputError } from "@/lib/admin-mutations";
import { clientUiUpdateSchema } from "@/lib/client-ui";
import { readClientUi, saveClientUi } from "@/lib/client-ui-store";

export const runtime = "nodejs";
async function settingsBody(request: NextRequest): Promise<unknown> {
  const reader=request.body?.getReader();
  if(!reader)throw new AdminInputError("Ожидается JSON настроек.");
  let bytes=0;let text="";const decoder=new TextDecoder("utf-8",{fatal:true});
  try {
    while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;
      if(bytes>16000){await reader.cancel();throw new AdminInputError("Слишком большой запрос.");}
      text+=decoder.decode(value,{stream:true});}
    return JSON.parse(text+decoder.decode());
  } catch(error){if(error instanceof AdminInputError)throw error;throw new AdminInputError("Ожидается корректный JSON настроек.");}
}
export async function GET(request: NextRequest) {
  const denied = await checkAdminApiAccess(request); if (denied) return denied;
  try { return NextResponse.json(await readClientUi(), {headers: {"Cache-Control": "no-store"}}); }
  catch (error) { return adminErrorResponse(error); }
}
export async function PUT(request: NextRequest) {
  const denied = await checkAdminApiAccess(request); if (denied) return denied;
  if (Number(request.headers.get("content-length")) > 16000) return NextResponse.json({error: "Слишком большой запрос."}, {status: 413});
  try {
    const parsed = clientUiUpdateSchema.safeParse(await settingsBody(request));
    if (!parsed.success) return NextResponse.json({error: parsed.error.issues[0]?.message || "Проверьте настройки."}, {status: 400});
    return NextResponse.json(await saveClientUi(parsed.data.revision, parsed.data.settings));
  } catch (error) { return adminErrorResponse(error); }
}
