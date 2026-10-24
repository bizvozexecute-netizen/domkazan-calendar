import { db } from "./db";
import { CLIENT_UI_DEFAULTS, clientUiSchema, type ClientUi } from "./client-ui";
import { AdminConflictError } from "./admin-mutations";

export async function readClientUi() {
  const row = await db.clientUiSettings.findUnique({where: {id: "public"}});
  const parsed = clientUiSchema.safeParse(row?.settings);
  return { revision: row?.revision ?? 0, settings: parsed.success ? parsed.data : CLIENT_UI_DEFAULTS };
}

export async function saveClientUi(revision: number, settings: ClientUi) {
  if (revision === 0) {
    try { await db.clientUiSettings.create({data: {id: "public", settings}}); }
    catch (error) {
      if ((error as {code?: string}).code === "P2002") throw new AdminConflictError("Настройки уже изменены. Обновите страницу перед сохранением.");
      throw error;
    }
  } else {
    const result = await db.clientUiSettings.updateMany({where: {id: "public", revision}, data: {settings, revision: {increment: 1}}});
    if (!result.count) throw new AdminConflictError("Настройки уже изменены. Обновите страницу перед сохранением.");
  }
  return {revision: revision + 1, settings};
}
