import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const cookiePrefix = process.env.SGU_DEMO === "true" ? "demo_" : "";
export const SESSION_COOKIE = `${cookiePrefix}customer_session`;
export const ADMIN_SESSION_COOKIE = `${cookiePrefix}admin_session`;
export const SESSION_AGE = 60 * 60 * 24;
export const sessionCookieOptions = {
  httpOnly: true, secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const, path: "/", maxAge: SESSION_AGE,
};

function sessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters");
  return secret;
}

export function ensureSessionConfigured() {
  sessionSecret();
}

function sign(value: string) {
  return createHmac("sha256", sessionSecret()).update(value).digest("hex");
}

// Bind the session to the current password without exposing its stored hash.
function passwordVersion(passwordHash: string) {
  return sign(`password:${passwordHash}`);
}

export function createSessionToken(userId: number, passwordHash: string, now = Date.now()) {
  if (!Number.isSafeInteger(userId) || userId <= 0 || !passwordHash || !Number.isSafeInteger(now) || now < 0) {
    throw new Error("Invalid session credentials");
  }
  const payload = `${userId}.${now + SESSION_AGE * 1000}.${passwordVersion(passwordHash)}.${randomBytes(16).toString("hex")}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string, now = Date.now()): number | null {
  if (!/^\d+\.\d+\.[a-f0-9]{64}\.[a-f0-9]{32}\.[a-f0-9]{64}$/.test(token)) return null;
  const [id, expires, version, nonce, signature] = token.split(".");
  if (!Number.isSafeInteger(Number(id)) || Number(id) <= 0 || !Number.isSafeInteger(Number(expires)) || Number(expires) <= now) return null;
  if (!timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(sign(`${id}.${expires}.${version}.${nonce}`), "hex"))) return null;
  return Number(id);
}

// Recheck eligibility against the database whenever a session is used.
export async function getCurrentUser(preferredAudience: "customer" | "admin" = "customer") {
  const cookieStore = await cookies();
  const candidates = [
    { name: SESSION_COOKIE, role: "CUSTOMER" },
    { name: ADMIN_SESSION_COOKIE, role: "ADMIN" },
  ];
  if (preferredAudience === "admin") candidates.reverse();

  for (const candidate of candidates) {
    const token = cookieStore.get(candidate.name)?.value;
    if (!token) continue;
    const id = verifySessionToken(token);
    if (!id) continue;
    const user = await prisma.user.findUnique({ where: { id }, select: { id: true, fullName: true, phone: true, role: true, isActive: true, password: true } });
    if (!user?.isActive || user.role !== candidate.role ||
      !timingSafeEqual(Buffer.from(token.split(".")[2], "hex"), Buffer.from(passwordVersion(user.password), "hex"))) continue;
    return { id: user.id, fullName: user.fullName, phone: user.phone, role: user.role, isActive: user.isActive };
  }
  return null;
}

export async function getCurrentAdmin() {
  const user = await getCurrentUser("admin");
  return user?.role === "ADMIN" ? user : null;
}

export async function getCurrentCustomer() {
  const user = await getCurrentUser();
  if (!user || user.role !== "CUSTOMER") return null;
  const customer = await prisma.customer.findUnique({ where: { phone: user.phone }, select: { id: true, name: true, status: true } });
  if (!customer || customer.status !== "Đang hoạt động") return null;
  return { userId: user.id, customerId: customer.id, name: customer.name };
}
