import { z } from "zod";
import { nightsBetween, parseDateOnly, todayInMoscow } from "./dates";

export const requestSchema = z.strictObject({
  houseId: z.string().min(1).max(100),
  checkIn: z.string(), checkOut: z.string(),
  guestCount: z.number().int().min(1).max(50),
  clientName: z.string().trim().min(2).max(100),
  clientPhone: z.string().trim().regex(/^\+?[0-9 ()-]{7,25}$/)
    .refine((value) => { const digits = value.replace(/\D/g, ""); return digits.length >= 10 && digits.length <= 15; }),
  messenger: z.enum(["TELEGRAM", "WHATSAPP"]).nullable().optional(),
  messengerContact: z.string().trim().max(100).nullable().optional(),
  comment: z.string().trim().max(2000).nullable().optional(),
  consent: z.literal(true),
  idempotencyKey: z.uuid(),
  website: z.string().max(100).optional(),
});
export type CustomerRequestInput = z.infer<typeof requestSchema>;

export class CustomerRequestError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function validateCustomerRequest(raw: unknown): CustomerRequestInput {
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) throw new CustomerRequestError(400, "Проверьте имя, телефон, даты и согласие на обработку данных.");
  const input = parsed.data;
  if (input.website) throw new CustomerRequestError(400, "Не удалось отправить заявку.");
  if (input.messenger && !input.messengerContact) throw new CustomerRequestError(400, "Укажите контакт мессенджера.");
  if (!input.messenger && input.messengerContact) throw new CustomerRequestError(400, "Укажите тип мессенджера.");
  const start = parseDateOnly(input.checkIn);
  const end = parseDateOnly(input.checkOut);
  if (!start || !end || start < todayInMoscow() || nightsBetween(start, end) < 1 || nightsBetween(start, end) > 60) {
    throw new CustomerRequestError(400, "Проверьте даты поездки (от 1 до 60 ночей, начиная с сегодня).");
  }
  return input;
}
