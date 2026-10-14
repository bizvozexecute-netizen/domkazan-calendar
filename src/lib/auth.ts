import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

export const SESSION_COOKIE = "domkazan_admin_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 8;
const WINDOW_MS = 15 * 60 * 1000;
const ACCOUNT_LIMIT = 5;
const GLOBAL_LIMIT = 100;

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters");
  return value;
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function credentialTag(): string {
  return createHmac("sha256", secret()).update(process.env.ADMIN_PASSWORD_HASH ?? "").digest("hex");
}

function throttleKey(scope: string): string {
  return createHmac("sha256", secret()).update(scope).digest("hex");
}

export function verifyAdminPassword(password: string): boolean {
  const stored = process.env.ADMIN_PASSWORD_HASH;
  if (!stored) return false;
  const [scheme, salt, expectedHex] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !/^[a-f0-9]{128}$/.test(expectedHex ?? "")) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return timingSafeEqual(actual, expected);
}

async function consumeAttempt(key: string, now: Date): Promise<number> {
  const resetBefore = new Date(now.getTime() - WINDOW_MS);
  const rows = await db.$queryRaw<{ attempts: number }[]>`
    INSERT INTO "LoginThrottle" ("key", "attempts", "windowStart") VALUES (${key}, 1, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "attempts" = CASE WHEN "LoginThrottle"."windowStart" < ${resetBefore}
        THEN 1 ELSE "LoginThrottle"."attempts" + 1 END,
      "windowStart" = CASE WHEN "LoginThrottle"."windowStart" < ${resetBefore}
        THEN ${now} ELSE "LoginThrottle"."windowStart" END
    RETURNING "attempts"
  `;
  return rows[0].attempts;
}

export async function allowLoginAttempt(): Promise<boolean> {
  const now = new Date();
  const [accountAttempts, globalAttempts] = await Promise.all([
    consumeAttempt(throttleKey("admin-account"), now),
    consumeAttempt(throttleKey("all-logins"), now),
  ]);
  return accountAttempts <= ACCOUNT_LIMIT && globalAttempts <= GLOBAL_LIMIT;
}

export async function clearAccountThrottle(): Promise<void> {
  await db.loginThrottle.deleteMany({ where: { key: throttleKey("admin-account") } });
}

export async function createAdminSession(email: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.$transaction([
    db.adminSession.deleteMany({ where: { email } }),
    db.adminSession.create({ data: {
      tokenHash: tokenHash(token), email, credentialTag: credentialTag(),
      expiresAt: new Date(Date.now() + SESSION_DURATION_SECONDS * 1000),
    } }),
  ]);
  return token;
}

export async function getAdminSessionFromToken(token: string | undefined): Promise<{ email: string } | null> {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const session = await db.adminSession.findUnique({ where: { tokenHash: tokenHash(token) } });
  if (!session || session.expiresAt <= new Date() || session.email !== process.env.ADMIN_EMAIL?.trim().toLowerCase()) return null;
  if (session.credentialTag !== credentialTag()) return null;
  return { email: session.email };
}

export async function getAdminSession(): Promise<{ email: string } | null> {
  return getAdminSessionFromToken((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function revokeAdminSession(token: string | undefined): Promise<void> {
  if (token && /^[A-Za-z0-9_-]{43}$/.test(token)) {
    await db.adminSession.deleteMany({ where: { tokenHash: tokenHash(token) } });
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_DURATION_SECONDS,
};
