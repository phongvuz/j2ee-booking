import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { runTransaction } from "@/lib/transaction";
import { BusinessError } from "@/lib/business-error";
import { getBookingMoney } from "@/lib/booking-money";
import type { MoneyMethod } from "@/types/order";

export async function receiveBookingPayment(id: number, method: MoneyMethod, actorId: number) {
  return runTransaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id },
      include: { trip: true, transactions: true },
    });
    if (!booking) return false;
    if (booking.status === "CANCELLED") {
      throw new BusinessError("Vé đã hủy. Không thể thu tiền.", 409);
    }
    const money = getBookingMoney(booking.totalPrice, booking.status, booking.transactions);
    if (money.amountDue === 0) return true;
    if (booking.expiresAt && booking.expiresAt <= new Date()) {
      throw new BusinessError("Vé đã hết hạn thanh toán.", 409);
    }
    if (booking.trip.status === "CANCELLED") {
      throw new BusinessError("Chuyến xe đã hủy.", 409);
    }
    await tx.bookingTransaction.create({
      data: {
        bookingId: id,
        kind: "RECEIPT",
        amount: money.amountDue,
        method,
        reference: randomBytes(16).toString("hex"),
        actorId,
      },
    });
    await tx.booking.update({
      where: { id },
      data: {
        status: "CONFIRMED",
        confirmedAt: booking.confirmedAt ?? new Date(),
        expiresAt: null,
      },
    });
    return true;
  });
}

export async function refundBookingPayment(id: number, method: MoneyMethod, actorId: number) {
  return runTransaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id }, include: { transactions: true } });
    if (!booking) return false;
    if (booking.status !== "CANCELLED") {
      throw new BusinessError("Chỉ hoàn tiền sau khi hủy vé.", 409);
    }
    const money = getBookingMoney(booking.totalPrice, booking.status, booking.transactions);
    if (money.refundDue === 0) return true;
    const isDemo = booking.transactions.some((entry) => entry.method === "DEMO");
    await tx.bookingTransaction.create({
      data: {
        bookingId: id,
        kind: "REFUND",
        amount: money.refundDue,
        method: isDemo ? "DEMO" : method,
        reference: randomBytes(16).toString("hex"),
        actorId,
      },
    });
    return true;
  });
}

export async function getFinancePositions() {
  return prisma.booking.findMany({
    select: {
      totalPrice: true,
      status: true,
      transactions: {
        select: { kind: true, amount: true, method: true, reference: true },
      },
    },
  });
}
