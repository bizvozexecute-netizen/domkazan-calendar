import type { CustomerRequestInput } from "./customer-request-validation";

// Preview stores test requests. Keep real contacts out even if a tester shares the URL.
export function permittedPreviewRequest(input: CustomerRequestInput): boolean {
  return input.clientName === "Тестовый Гость" &&
    input.clientPhone === "+70000000000" &&
    !input.messenger && !input.messengerContact;
}
