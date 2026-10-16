import { setTimeout as delay } from "node:timers/promises";

const url = process.env.TELEGRAM_RETRY_URL;
const secret = process.env.TELEGRAM_RETRY_SECRET;
if (!url || !secret || secret.length < 32) throw new Error("Telegram scheduler configuration is missing");
const target = new URL(url);
if (target.pathname !== "/api/internal/telegram/retry" || target.username || target.password) throw new Error("Invalid retry URL");
let running = true;
process.on("SIGTERM", () => { running = false; });
process.on("SIGINT", () => { running = false; });
// Await each run before the next tick. Multiple replicas are additionally protected by per-notification database leases.
while (running) {
  try {
    const response = await fetch(target, { method: "POST", headers: { Authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(120_000) });
    console.log(response.ok ? "Telegram retry cycle completed" : `Telegram retry cycle failed (${response.status})`);
  } catch { console.error("Telegram retry cycle unavailable; will retry"); }
  if (running) await delay(60_000);
}
