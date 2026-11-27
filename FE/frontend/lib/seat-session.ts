import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { BusinessError } from "@/lib/business-error";

export const SEAT_SESSION_COOKIE = "seat_session";
const SESSION_AGE = 24 * 60 * 60;

function sign(value: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters");
  return createHmac("sha256", secret).update(`seat:${value}`).digest("hex");
}

export function createSeatSessionToken(now = Date.now()) {
  const payload = `${randomBytes(32).toString("hex")}.${now + SESSION_AGE * 1000}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySeatSessionToken(token: string, now = Date.now()): string | null {
  if (!/^[a-f0-9]{64}\.\d+\.[a-f0-9]{64}$/.test(token)) return null;
  const [id, expires, signature] = token.split(".");
  if (!Number.isSafeInteger(Number(expires)) || Number(expires) <= now) return null;
  return timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(sign(`${id}.${expires}`), "hex")) ? id : null;
}

function readSession(request: Request) {
  const token = request.headers.get("cookie")?.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${SEAT_SESSION_COOKIE}=`))?.slice(SEAT_SESSION_COOKIE.length + 1);
  return token ? verifySeatSessionToken(token) : null;
}

// The browser receives a signed HttpOnly cookie. Public tab IDs never grant ownership.
export function ensureSeatSession(request: Request) {
  const existing = readSession(request);
  if (existing) return { id: existing, cookie: undefined };
  const token = createSeatSessionToken();
  return {
    id: verifySeatSessionToken(token)!,
    cookie: `${SEAT_SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_AGE}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
  };
}

export function deriveSeatOwner(sessionId: string, clientId: string) {
  return sign(`owner:${sessionId}:${clientId}`);
}

export function requireSeatOwner(request: Request, clientId: string) {
  const sessionId = readSession(request);
  if (!sessionId) throw new BusinessError("Phiên chọn ghế đã hết hạn. Vui lòng kết nối lại.", 409);
  return deriveSeatOwner(sessionId, clientId);
}
