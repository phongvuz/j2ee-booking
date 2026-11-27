import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { registerSchema } from "@/lib/validations/register";
import { nextCustomerId } from "@/lib/customer-id";
import { NextResponse } from "next/server";
import { createSessionToken, ensureSessionConfigured, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { isSameOriginRequest } from "@/lib/request-origin";
import { createGuestPhone } from "@/lib/guest-account";
import { BusinessError } from "@/lib/business-error";

export const runtime = "nodejs";

const duplicateMessage = "Email hoặc số điện thoại đã được đăng ký!";
const accountSelect = { id: true, fullName: true, role: true, isActive: true } as const;

function isLegacyGuest(user: { role: string; isActive: boolean } | null) {
  return user?.role === "USER" && user.isActive;
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return Response.json({ success: false, message: "Nguồn yêu cầu không hợp lệ!" }, { status: 403 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, message: "Dữ liệu đăng ký không hợp lệ!" }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ success: false, message: parsed.error.issues[0].message }, { status: 400 });
  }

  const { fullName, email, phone, address, password } = parsed.data;
  try {
    const [existingUser, existingCustomer] = await Promise.all([
      prisma.user.findUnique({ where: { phone }, select: accountSelect }),
      prisma.customer.findFirst({ where: { OR: [{ email }, { phone }] }, select: { id: true } }),
    ]);
    if (existingCustomer || (existingUser && !isLegacyGuest(existingUser))) {
      return Response.json({ success: false, message: duplicateMessage }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    // Validate session configuration before committing a new account.
    ensureSessionConfigured();
    let sessionToken = "";
    // Retry deadlocks/serialization conflicts when registrations allocate the same ID.
    for (let attempt = 0; ; attempt++) {
      try {
        sessionToken = await prisma.$transaction(async (tx) => {
          const [currentUser, currentCustomer] = await Promise.all([
            tx.user.findUnique({ where: { phone }, select: accountSelect }),
            tx.customer.findFirst({ where: { OR: [{ email }, { phone }] }, select: { id: true } }),
          ]);
          if (currentCustomer || (currentUser && !isLegacyGuest(currentUser))) {
            throw new BusinessError(duplicateMessage, 409);
          }
          if (currentUser) {
            // Keep past bookings with the guest, never grant them to an unverified registrant.
            await tx.booking.updateMany({ where: { userId: currentUser.id, passengerPhone: null }, data: { passengerPhone: phone } });
            await tx.booking.updateMany({ where: { userId: currentUser.id, passengerName: null }, data: { passengerName: currentUser.fullName } });
            await tx.user.update({ where: { id: currentUser.id }, data: { phone: createGuestPhone() } });
          }
          const id = await nextCustomerId(tx);
          const user = await tx.user.create({
            data: { fullName, phone, password: passwordHash, role: "CUSTOMER" },
            select: { id: true },
          });
          await tx.customer.create({
            data: { id, name: fullName, email, phone, address: address || null },
            select: { id: true },
          });
          return createSessionToken(user.id, passwordHash);
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        break;
      } catch (error) {
        const retryable = error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === "P2034" || (error.code === "P2002" &&
            (error.meta?.target === "PRIMARY" ||
              (Array.isArray(error.meta?.target) && error.meta.target.includes("id")))));
        if (!retryable || attempt >= 4) throw error;
      }
    }

    const response = NextResponse.json({ success: true, message: "Đăng ký tài khoản thành công!", redirectTo: "/" }, { status: 201, headers: { "Cache-Control": "no-store" } });
    response.cookies.set(SESSION_COOKIE, sessionToken, sessionCookieOptions);
    return response;
  } catch (error) {
    if (error instanceof BusinessError) {
      return Response.json({ success: false, message: error.message }, { status: error.status });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return Response.json({ success: false, message: duplicateMessage }, { status: 409 });
    }
    return Response.json({ success: false, message: "Không thể đăng ký lúc này. Vui lòng thử lại sau!" }, { status: 500 });
  }
}
