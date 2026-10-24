import { z } from "zod";
import { nightsBetween, parseDateOnly } from "./dates";

const optionalText = (limit: number) => z.string().trim().max(limit).nullable();
const price = z.string().regex(/^\d{1,8}(?:\.\d{1,2})?$/, "Укажите цену в рублях, до двух знаков после запятой.");

export const houseSchema = z.object({
  name: z.string().trim().min(1).max(120),
  calendarName: z.string().trim().min(1).max(40).nullable().optional(),
  tildaProductUid: z.string().regex(/^\d{1,30}$/).nullable().optional(),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Используйте латинские буквы, цифры и дефисы."),
  tildaUrl: z.string().url().refine((value) => /^https?:\/\//.test(value)).nullable(),
  maxGuests: z.number().int().min(1).max(100),
  includedGuests: z.number().int().min(1).max(100).nullable().optional(),
  extraGuestPrice: price.optional(),
  serviceFee: price.optional(),
  district: optionalText(100),
  bedrooms: z.number().int().min(0).max(50).nullable(),
  bathrooms: z.number().int().min(0).max(50).nullable(),
  amenities: z.array(z.string().trim().min(1).max(40)).max(30),
  petsAllowed: z.boolean().nullable(),
  isActive: z.boolean(),
}).refine(value => value.includedGuests == null || value.includedGuests <= value.maxGuests,
  { message: "Число включённых гостей не может превышать вместимость.", path: ["includedGuests"] })
  .refine(value => !Number(value.extraGuestPrice) || value.includedGuests != null,
    { message: "Укажите число гостей, включённых в стоимость.", path: ["includedGuests"] });

export const rateSchema = z.object({
  startsOn: z.string(),
  endsOn: z.string(),
  weekdayPrice: price,
  fridayPrice: price,
  saturdayPrice: price,
  sundayPrice: price,
  minNights: z.number().int().min(1).max(60),
});

export const calendarActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("close"), houseId: z.string(), revision: z.number().int().min(0), start: z.string(), end: z.string() }),
  z.object({ action: z.literal("open"), houseId: z.string(), revision: z.number().int().min(0), start: z.string(), end: z.string() }),
  z.object({ action: z.literal("setPrice"), houseId: z.string(), revision: z.number().int().min(0), start: z.string(), end: z.string(), price }),
  z.object({ action: z.literal("clearPrice"), houseId: z.string(), revision: z.number().int().min(0), start: z.string(), end: z.string() }),
]);

export function parsePeriod(start: string, end: string, maxNights = 3660): { startsOn: Date; endsOn: Date } | null {
  const startsOn = parseDateOnly(start);
  const endsOn = parseDateOnly(end);
  const nights = startsOn && endsOn ? nightsBetween(startsOn, endsOn) : 0;
  return startsOn && endsOn && startsOn >= new Date("2000-01-01T00:00:00.000Z") &&
    endsOn <= new Date("2101-01-01T00:00:00.000Z") && nights > 0 && nights <= maxNights
    ? { startsOn, endsOn } : null;
}

export type HouseFields = z.infer<typeof houseSchema>;
export type RateFields = z.infer<typeof rateSchema>;
export type CalendarAction = z.infer<typeof calendarActionSchema>;
