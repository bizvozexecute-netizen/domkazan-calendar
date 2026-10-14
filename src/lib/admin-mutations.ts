import type { Prisma } from "../../generated/prisma/client";
import { db } from "./db";
import { eachNight } from "./dates";
import { assertValidRatePeriod, RateConflictError } from "./rates";
import { parsePeriod, type CalendarAction, type HouseFields, type RateFields } from "./admin-validation";

export class AdminConflictError extends Error {
  constructor(message = "Данные изменились в другой вкладке. Обновите страницу и повторите действие.") { super(message); }
}
export class AdminInputError extends Error {}
export class AdminNotFoundError extends Error {}

export function normalizeAdminError(error: unknown): Error {
  if (error instanceof AdminConflictError || error instanceof AdminInputError || error instanceof AdminNotFoundError) return error;
  if (error instanceof RateConflictError) return new AdminConflictError(error.message);
  const code = (error as { code?: string })?.code;
  if (code === "P2002") return new AdminConflictError("Такой идентификатор дома уже существует.");
  if (code === "P2034" || code === "P2004" || code === "23P01" || String(error).includes("_no_overlap")) {
    return new AdminConflictError("Выбранный период пересекается с существующим. Обновите данные.");
  }
  return error instanceof Error ? error : new Error("Неизвестная ошибка.");
}

async function bumpRevision(tx: Prisma.TransactionClient, houseId: string, revision: number): Promise<number> {
  const result = await tx.house.updateMany({ where: { id: houseId, revision }, data: { revision: { increment: 1 } } });
  if (result.count !== 1) throw new AdminConflictError();
  return revision + 1;
}

export async function createHouse(fields: HouseFields) {
  try { return await db.house.create({ data: fields }); }
  catch (error) { throw normalizeAdminError(error); }
}

export async function updateHouse(houseId: string, revision: number, fields: HouseFields) {
  try {
    return await db.$transaction(async (tx) => {
      const result = await tx.house.updateMany({ where: { id: houseId, revision }, data: { ...fields, revision: { increment: 1 } } });
      if (result.count !== 1) throw new AdminConflictError();
      return tx.house.findUniqueOrThrow({ where: { id: houseId } });
    }, { isolationLevel: "Serializable" });
  } catch (error) { throw normalizeAdminError(error); }
}

export async function saveRate(houseId: string, revision: number, fields: RateFields, rateId?: string) {
  const period = parsePeriod(fields.startsOn, fields.endsOn);
  if (!period) throw new AdminInputError("Проверьте даты тарифного периода.");
  try {
    return await db.$transaction(async (tx) => {
      const nextRevision = await bumpRevision(tx, houseId, revision);
      if (rateId && !await tx.baseRate.findFirst({ where: { id: rateId, houseId }, select: { id: true } })) throw new AdminNotFoundError("Тариф не найден.");
      const existing = await tx.baseRate.findMany({
        where: { houseId, ...(rateId && { id: { not: rateId } }), startsOn: { lt: period.endsOn }, endsOn: { gt: period.startsOn } },
        select: { startsOn: true, endsOn: true },
      });
      assertValidRatePeriod(period, existing);
      const data = { ...period, weekdayPrice: fields.weekdayPrice, fridayPrice: fields.fridayPrice,
        saturdayPrice: fields.saturdayPrice, sundayPrice: fields.sundayPrice, minNights: fields.minNights };
      const rate = rateId
        ? await tx.baseRate.update({ where: { id: rateId }, data })
        : await tx.baseRate.create({ data: { houseId, ...data } });
      return { rate, revision: nextRevision };
    }, { isolationLevel: "Serializable" });
  } catch (error) { throw normalizeAdminError(error); }
}

export async function deleteRate(houseId: string, rateId: string, revision: number) {
  try {
    return await db.$transaction(async (tx) => {
      const nextRevision = await bumpRevision(tx, houseId, revision);
      const deleted = await tx.baseRate.deleteMany({ where: { id: rateId, houseId } });
      if (deleted.count !== 1) throw new AdminNotFoundError("Тариф не найден.");
      return nextRevision;
    }, { isolationLevel: "Serializable" });
  } catch (error) { throw normalizeAdminError(error); }
}

export async function changeCalendar(input: CalendarAction) {
  const period = parsePeriod(input.start, input.end, 366);
  if (!period) throw new AdminInputError("Выберите от 1 до 366 последовательных дат.");
  try {
    return await db.$transaction(async (tx) => {
      const revision = await bumpRevision(tx, input.houseId, input.revision);
      if (input.action === "setPrice") {
        for (const date of eachNight(period.startsOn, period.endsOn)) {
          await tx.dateOverride.upsert({ where: { houseId_date: { houseId: input.houseId, date } },
            update: { pricePerNight: input.price }, create: { houseId: input.houseId, date, pricePerNight: input.price } });
        }
      } else if (input.action === "clearPrice") {
        await tx.dateOverride.deleteMany({ where: { houseId: input.houseId, date: { gte: period.startsOn, lt: period.endsOn } } });
      } else if (input.action === "close") {
        const touching = await tx.blockedPeriod.findMany({ where: { houseId: input.houseId,
          startsOn: { lte: period.endsOn }, endsOn: { gte: period.startsOn } } });
        const startsOn = new Date(Math.min(period.startsOn.getTime(), ...touching.map((item) => item.startsOn.getTime())));
        const endsOn = new Date(Math.max(period.endsOn.getTime(), ...touching.map((item) => item.endsOn.getTime())));
        await tx.blockedPeriod.deleteMany({ where: { id: { in: touching.map((item) => item.id) } } });
        await tx.blockedPeriod.create({ data: { houseId: input.houseId, startsOn, endsOn, reason: "Закрыто администратором" } });
      } else {
        const overlapping = await tx.blockedPeriod.findMany({ where: { houseId: input.houseId,
          startsOn: { lt: period.endsOn }, endsOn: { gt: period.startsOn } } });
        await tx.blockedPeriod.deleteMany({ where: { id: { in: overlapping.map((item) => item.id) } } });
        for (const block of overlapping) {
          if (block.startsOn < period.startsOn) await tx.blockedPeriod.create({ data: {
            houseId: input.houseId, startsOn: block.startsOn, endsOn: period.startsOn, reason: block.reason,
          } });
          if (block.endsOn > period.endsOn) await tx.blockedPeriod.create({ data: {
            houseId: input.houseId, startsOn: period.endsOn, endsOn: block.endsOn, reason: block.reason,
          } });
        }
      }
      return revision;
    }, { isolationLevel: "Serializable", timeout: 20000 });
  } catch (error) { throw normalizeAdminError(error); }
}
