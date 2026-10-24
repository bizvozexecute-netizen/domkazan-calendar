import { z } from "zod";
import defaults from "../config/client-ui-defaults.json" with { type: "json" };

export const CLIENT_UI_DEFAULTS = defaults;
export type ClientUi = typeof defaults;
export const TEXT_LABELS: Record<keyof ClientUi["texts"], string> = {
  searchTitle: "Заголовок каталога", detailTitle: "Заголовок проверки стоимости", requestTitle: "Заголовок формы заявки",
  searchButton: "Кнопка поиска", quoteButton: "Кнопка расчёта", requestButton: "Кнопка открытия заявки", submitButton: "Кнопка отправки",
  videoButton: "Кнопка видео", phoneButton: "Кнопка звонка", telegramButton: "Кнопка Telegram", whatsappButton: "Кнопка WhatsApp",
  searchError: "Ошибка поиска", requestError: "Ошибка данных заявки", requestSuccess: "Заявка получена",
  occupiedMessage: "Выбранные даты заняты", unpricedMessage: "Отсутствует тариф", unavailableMessage: "Другие условия недоступности",
};

export function contrast(a: string, b: string): number {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
const color = z.string().regex(/^#[0-9a-f]{6}$/i, "Укажите цвет в формате #RRGGBB.");
const text = (max: number) => z.string().trim().min(1).max(max)
  .refine(value => !/[<>{}\u0000-\u001f\u007f]/.test(value), "Допустим только обычный текст без HTML и управляющих символов.");
const texts = Object.fromEntries(Object.keys(defaults.texts).map(key => [key, text(key.endsWith("Button") ? 40 : 240)])) as Record<keyof ClientUi["texts"], ReturnType<typeof text>>;
export const clientUiSchema = z.strictObject({
  colors: z.strictObject({ primary: color, text: color, background: color }).superRefine((value, ctx) => {
    for (const key of ["primary", "text"] as const) {
      if (contrast(value[key], "#FFFFFF") < 4.5 || contrast(value[key], value.background) < 4.5)
        ctx.addIssue({code: "custom", path: [key], message: "Контраст с белым и фоном должен быть не ниже 4.5:1."});
    }
    if (contrast(value.background, "#586B80") < 4.5)
      ctx.addIssue({code: "custom", path: ["background"], message: "Выберите светлый фон: контраст вспомогательных подписей должен быть не ниже 4.5:1."});
  }),
  texts: z.strictObject(texts),
});
export const clientUiUpdateSchema = z.strictObject({ revision: z.number().int().min(0), settings: clientUiSchema });
