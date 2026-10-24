import { timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

export function equalSecret(supplied: string, expected: string): boolean {
  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function clientIp(headers: Headers): string {
  const secret = process.env.TRUSTED_PROXY_SECRET;
  if (!secret || secret.length < 32 || !equalSecret(headers.get("x-domkazan-proxy-secret") ?? "", secret)) return "unknown";
  const ip = headers.get("x-domkazan-client-ip")?.trim() ?? "";
  return isIP(ip) ? ip.toLowerCase() : "unknown";
}

export function privacyPolicyUrl(): string | null {
  try {
    const preview = testPreviewOrigin();
    const fallback = preview && process.env.TEST_CATALOG_ENABLED === "true" ? `${preview}/test-policy` : "";
    const url = new URL(process.env.PRIVACY_POLICY_URL || fallback);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

function testPreviewOrigin(): string | null {
  if (process.env.VERCEL_ENV !== "preview") return null;
  const host = process.env.VERCEL_URL ?? "";
  if (!/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.vercel\.app$/.test(host)) return null;
  return `https://${host}`;
}

export function insecureLocalHttp(): boolean {
  try {
    const url = new URL(process.env.APP_ORIGIN ?? "");
    return process.env.ALLOW_INSECURE_LOCAL_HTTP === "true" && url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  } catch { return false; }
}

export function appOrigin(request: Request): string {
  const configured = process.env.APP_ORIGIN || testPreviewOrigin();
  if (!configured && process.env.VERCEL_ENV === "preview") throw new Error("Invalid Vercel preview URL");
  if (!configured && process.env.NODE_ENV !== "production") return new URL(request.url).origin;
  const url = new URL(configured || "");
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash ||
    (url.protocol !== "https:" && !insecureLocalHttp())) throw new Error("Invalid APP_ORIGIN");
  return url.origin;
}
