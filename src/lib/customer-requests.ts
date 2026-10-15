import { createHmac } from "node:crypto";
import { Prisma } from "../../generated/prisma/client";
import { db } from "./db";
import { parseDateOnly } from "./dates";
import { quoteStay } from "./pricing";
import { CustomerRequestError, type CustomerRequestInput } from "./customer-request-validation";

function digest(value: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET is required");
  return createHmac("sha256", secret).update(value).digest("hex");
}

async function incrementThrottle(key: string, limit: number) {
  const rows = await db.$queryRaw<{ attempts: number }[]>`
    INSERT INTO "RequestThrottle" ("key", "attempts", "windowStart") VALUES (${key}, 1, NOW())
    ON CONFLICT ("key") DO UPDATE SET
      "attempts" = CASE WHEN "RequestThrottle"."windowStart" < NOW() - INTERVAL '15 minutes'
        THEN 1 ELSE "RequestThrottle"."attempts" + 1 END,
      "windowStart" = CASE WHEN "RequestThrottle"."windowStart" < NOW() - INTERVAL '15 minutes'
        THEN NOW() ELSE "RequestThrottle"."windowStart" END
    RETURNING "attempts"`;
  if (rows[0].attempts > limit) throw new CustomerRequestError(429, "Слишком много заявок. Попробуйте позже.");
}

export async function createCustomerRequest(input: CustomerRequestInput, clientIp: string) {
  const payloadHash = digest(JSON.stringify({ ...input, website: undefined }));
  const existing = await db.bookingRequest.findUnique({ where: { idempotencyKey: input.idempotencyKey }, select: { id: true, payloadHash: true, quotedTotal: true } });
  if (existing) {
    if (existing.payloadHash !== payloadHash) throw new CustomerRequestError(409, "Этот запрос уже был использован для другой заявки.");
    return { id: existing.id, total: existing.quotedTotal?.toString() ?? null, created: false };
  }
  await incrementThrottle(`ip:${digest(clientIp)}`, 12);
  await incrementThrottle(`phone:${digest(input.clientPhone.replace(/\D/g, ""))}`, 5);

  const checkIn = parseDateOnly(input.checkIn)!;
  const checkOut = parseDateOnly(input.checkOut)!;
  try {
    const created = await db.$transaction(async (tx) => {
      // Serialize with calendar edits and confirmations for this house.
      await tx.$queryRaw`SELECT "id" FROM "House" WHERE "id" = ${input.houseId} FOR UPDATE`;
      const house = await tx.house.findFirst({
        where: { id: input.houseId, isActive: true, maxGuests: { gte: input.guestCount },
          blockedPeriods: { none: { startsOn: { lt: checkOut }, endsOn: { gt: checkIn } } },
          bookingRequests: { none: { status: "CONFIRMED", checkIn: { lt: checkOut }, checkOut: { gt: checkIn } } } },
        include: { baseRates: { where: { startsOn: { lt: checkOut }, endsOn: { gt: checkIn } } },
          dateOverrides: { where: { date: { gte: checkIn, lt: checkOut } } } },
      });
      if (!house) throw new CustomerRequestError(409, "Дом уже недоступен на выбранные даты. Обновите поиск.");
      const quote = quoteStay(checkIn, checkOut, house.baseRates, house.dateOverrides);
      if (!quote) throw new CustomerRequestError(409, "Для этих дат пока нет тарифа. Выберите другие даты.");
      const booking = await tx.bookingRequest.create({ data: {
        houseId: house.id, checkIn, checkOut, guestCount: input.guestCount,
        clientName: input.clientName, clientPhone: input.clientPhone,
        messenger: input.messenger ?? null, messengerContact: input.messengerContact ?? null,
        message: input.comment ?? null, consentAt: new Date(), quotedTotal: quote.total,
        idempotencyKey: input.idempotencyKey, payloadHash,
      } });
      await tx.telegramNotification.create({ data: { bookingRequestId: booking.id } });
      return { id: booking.id, total: quote.total, created: true };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return created;
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      const duplicate = await db.bookingRequest.findUnique({ where: { idempotencyKey: input.idempotencyKey }, select: { id: true, payloadHash: true, quotedTotal: true } });
      if (duplicate?.payloadHash === payloadHash) return { id: duplicate.id, total: duplicate.quotedTotal?.toString() ?? null, created: false };
      throw new CustomerRequestError(409, "Этот запрос уже был использован для другой заявки.");
    }
    if (["P2034", "P2010"].includes((error as { code?: string }).code ?? "")) {
      throw new CustomerRequestError(409, "Доступность изменилась. Обновите поиск.");
    }
    throw error;
  }
}
