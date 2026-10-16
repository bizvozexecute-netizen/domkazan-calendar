import { BookingStatus, Prisma } from "../../generated/prisma/client";
import { db } from "./db";
import { AdminConflictError, AdminInputError, AdminNotFoundError, normalizeAdminError } from "./admin-mutations";

const transitions: Record<BookingStatus, BookingStatus[]> = {
  NEW: ["CONTACTED", "CONFIRMED", "DECLINED", "CANCELLED"],
  CONTACTED: ["CONFIRMED", "DECLINED", "CANCELLED"],
  CONFIRMED: ["CANCELLED"], DECLINED: [], CANCELLED: [],
};

export async function changeBookingStatus(id: string, status: BookingStatus, paymentAcknowledged = false) {
  if (status === "CONFIRMED" && !paymentAcknowledged) throw new AdminInputError("Подтвердите, что оплата проверена вручную.");
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
      const initial = await tx.bookingRequest.findUnique({ where: { id }, select: { houseId: true } });
      if (!initial) throw new AdminNotFoundError("Заявка не найдена.");
      // A write lock serializes confirmation with calendar edits for the same house.
      await tx.house.update({ where: { id: initial.houseId }, data: { revision: { increment: 1 } } });
      const booking = await tx.bookingRequest.findUniqueOrThrow({ where: { id } });
      if (booking.status === status) return booking;
      if (!transitions[booking.status].includes(status)) throw new AdminConflictError("Этот переход статуса недоступен. Обновите заявку.");
      if (status === "CONFIRMED") {
        const occupied = await tx.blockedPeriod.count({ where: { houseId: booking.houseId,
          startsOn: { lt: booking.checkOut }, endsOn: { gt: booking.checkIn } } });
        const otherBooking = await tx.bookingRequest.count({ where: { id: { not: id }, houseId: booking.houseId,
          status: "CONFIRMED", checkIn: { lt: booking.checkOut }, checkOut: { gt: booking.checkIn } } });
        if (occupied || otherBooking) throw new AdminConflictError("Даты уже заняты. Подтверждение невозможно.");
      }
      const changed = await tx.bookingRequest.update({ where: { id }, data: { status } });
      return changed;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      const code = (error as { code?: string }).code;
      const sqlState = (error as { meta?: { code?: string } }).meta?.code;
      if ((code === "P2034" || (code === "P2010" && ["40001", "40P01"].includes(sqlState ?? ""))) && attempt < 2) continue;
      throw normalizeAdminError(error);
    }
  }
  throw new AdminConflictError("Данные изменились одновременно. Повторите действие.");
}
