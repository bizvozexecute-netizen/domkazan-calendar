import { db } from "./db";
import { dateKey } from "./dates";

type TelegramResult = { ok?: boolean; parameters?: { retry_after?: number } };

function messageFor(request: {
  id: string; checkIn: Date; checkOut: Date; guestCount: number; quotedTotal: { toString(): string } | null;
  clientName: string; clientPhone: string | null; messenger: string | null; messengerContact: string | null;
  message: string | null; house: { name: string };
}) {
  return [
    `Новая заявка ${request.id}`,
    `Дом: ${request.house.name}`,
    `Даты: ${dateKey(request.checkIn)} — ${dateKey(request.checkOut)}`,
    `Гостей: ${request.guestCount}`,
    `Стоимость: ${request.quotedTotal?.toString() ?? "не указана"} ₽`,
    `Имя: ${request.clientName}`,
    `Телефон: ${request.clientPhone ?? "не указан"}`,
    request.messenger ? `${request.messenger}: ${request.messengerContact ?? ""}` : null,
    request.message ? `Комментарий: ${request.message}` : null,
  ].filter(Boolean).join("\n");
}

export async function deliverTelegramNotification(id: string, now = new Date()): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;
  const claimed = await db.$queryRaw<{ id: string }[]>`
    UPDATE "TelegramNotification" SET "lockedUntil" = ${new Date(now.getTime() + 30_000)}
    WHERE "id" = ${id} AND "status" = 'PENDING' AND "nextAttemptAt" <= ${now}
      AND ("lockedUntil" IS NULL OR "lockedUntil" < ${now}) RETURNING "id"`;
  if (!claimed.length) return false;
  const notification = await db.telegramNotification.findUniqueOrThrow({ where: { id },
    include: { bookingRequest: { include: { house: { select: { name: true } } } } } });
  let sent = false;
  let retrySeconds = 0;
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: messageFor(notification.bookingRequest),
        link_preview_options: { is_disabled: true } }),
      signal: AbortSignal.timeout(5000),
    });
    const result = await response.json() as TelegramResult;
    sent = response.ok && result.ok === true;
    retrySeconds = Math.min(3600, Math.max(0, result.parameters?.retry_after ?? 0));
  } catch { /* Retry from the outbox; never expose Telegram errors to clients. */ }
  if (sent) {
    await db.telegramNotification.update({ where: { id }, data: { status: "SENT", sentAt: new Date(), attempts: { increment: 1 }, lockedUntil: null } });
  } else {
    const delay = Math.max(retrySeconds, Math.min(3600, 15 * 2 ** Math.min(notification.attempts, 8)));
    await db.telegramNotification.update({ where: { id }, data: {
      attempts: { increment: 1 }, nextAttemptAt: new Date(Date.now() + delay * 1000), lockedUntil: null,
    } });
  }
  return sent;
}

export async function deliverDueTelegramNotifications(limit = 20): Promise<{ attempted: number; sent: number }> {
  await db.requestThrottle.deleteMany({ where: { windowStart: { lt: new Date(Date.now() - 86_400_000) } } });
  const due = await db.telegramNotification.findMany({
    where: { status: "PENDING", nextAttemptAt: { lte: new Date() }, OR: [{ lockedUntil: null }, { lockedUntil: { lt: new Date() } }] },
    orderBy: { nextAttemptAt: "asc" }, take: Math.min(limit, 50), select: { id: true },
  });
  let sent = 0;
  for (const item of due) if (await deliverTelegramNotification(item.id)) sent++;
  return { attempted: due.length, sent };
}
