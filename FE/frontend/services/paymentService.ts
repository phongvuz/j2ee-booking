import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { runTransaction } from "@/lib/transaction";
import { BusinessError } from "@/lib/business-error";
import { createVietqrUrl, getVietqrConfig, isPaymentDemoEnabled } from "@/lib/vietqr";
import type { VietqrPaymentInfo } from "@/types/payment";
import { getBookingMoney, getMoneySummary } from "@/lib/booking-money";

export async function getVietqrPaymentInfo(pnr: string): Promise<VietqrPaymentInfo> {
  const bookings = await prisma.booking.findMany({ where: { pnr }, include: { transactions: true }, orderBy: { id: "asc" } });
  if (!bookings.length) throw new BusinessError("Không tìm thấy mã đặt chỗ.", 404);
  const config = getVietqrConfig();
  const total_amount = getMoneySummary(bookings).amountDue;
  if (!total_amount) throw new BusinessError("Lượt đặt này không còn tiền phải thu.", 409);
  // Một lượt có nhiều vé: dùng ID vé đầu tiên làm mã đơn hàng ngắn, duy nhất.
  const order_code = `VE${bookings[0].id}`;
  return { bankName: config.bankName, accountNo: config.accountNo, accountName: config.accountName,
    total_amount, order_code, qrUrl: createVietqrUrl(total_amount, order_code) };
}

export async function getPaymentStatus(pnr: string) {
  const [bookings, payment] = await Promise.all([
    prisma.booking.findMany({ where: { pnr }, include: { transactions: true } }),
    prisma.payment.findFirst({ where: { pnr, status: { in: ["SUCCESS", "REVIEW"] } }, orderBy: { createdAt: "desc" } }),
  ]);
  if (!bookings.length) throw new BusinessError("Không tìm thấy mã đặt chỗ.", 404);
  const active = bookings.filter((booking) => booking.status !== "CANCELLED");
  const money = getMoneySummary(bookings);
  let status = payment?.status ?? "NONE";
  if (money.refundDue > 0) status = "REFUND_DUE";
  else if (money.refunded > 0) status = active.length ? "PARTIALLY_REFUNDED" : "REFUNDED";
  return { status, bookingStatus: active.length && active.every((booking) => booking.status === "CONFIRMED") ? "CONFIRMED" : active.some((booking) => booking.status === "PENDING") ? "PENDING" : "UNAVAILABLE", ...money };
}

// DEMO: giả lập nhận tiền, không gọi ngân hàng và không kiểm tra số dư.
export async function confirmDemoPayment(pnr: string) {
  if (!isPaymentDemoEnabled()) throw new BusinessError("Chế độ xác nhận thanh toán demo đang tắt.", 403);
  getVietqrConfig();
  return runTransaction(async (tx) => {
    const bookings = await tx.booking.findMany({ where: { pnr }, include: { trip: true, transactions: true }, orderBy: { id: "asc" } });
    if (!bookings.length) throw new BusinessError("Không tìm thấy mã đặt chỗ.", 404);
    const received = await tx.payment.findFirst({ where: { pnr, status: { in: ["SUCCESS", "REVIEW"] } } });
    const payable = bookings.filter((booking) => booking.status !== "CANCELLED" && getBookingMoney(booking.totalPrice, booking.status, booking.transactions).amountDue > 0);
    if (received) {
      if (received.status === "SUCCESS" && !payable.length && bookings.some((booking) => booking.status === "CONFIRMED")) {
        return { status: "SUCCESS", bookingStatus: "CONFIRMED" }; // Bấm lại: không tạo record mới.
      }
      if (received.status === "REVIEW") throw new BusinessError("Lượt đặt chỗ cần đối soát. Vui lòng liên hệ nhà xe.", 409);
    }
    if (!payable.length) throw new BusinessError("Không còn vé chờ thanh toán trong lượt đặt này.", 409);
    const now = new Date();

    if (payable.some((b) => b.expiresAt && b.expiresAt <= now)) {
      throw new BusinessError(
        "Vé đã hết hạn thanh toán. Vui lòng đặt vé mới.",
        409,
      );
    }

    if (
      payable.some(
        (b) => b.status !== "PENDING" || b.trip.time <= now || b.trip.status !== "OPEN",
      )
    ) {
      throw new BusinessError(
        "Chỉ xác nhận được lượt đặt chỗ đang chờ thanh toán và chưa xuất bến.",
        409,
      );
    }
    // Backend tự tính tiền, không nhận giá hoặc trạng thái từ trình duyệt.
    const amount = getMoneySummary(payable).amountDue;
    const orderCode = `VE${bookings[0].id}`;
    const qrUrl = createVietqrUrl(amount, orderCode);
    const paidAt = new Date();
    const id = randomBytes(16).toString("hex");
    await tx.payment.create({ data: {
      id, pnr, amount, status: "SUCCESS", responseCode: "DEMO",
      providerTransactionId: `DEMO-${id}`, checkoutUrl: qrUrl,
      createdAt: paidAt, paidAt, expiresAt: bookings[0].trip.time,
    } });
    await tx.bookingTransaction.createMany({ data: payable.map((booking) => ({
      bookingId: booking.id, kind: "RECEIPT", amount: getBookingMoney(booking.totalPrice, booking.status, booking.transactions).amountDue,
      method: "DEMO", reference: id,
    })) });
    const updated = await tx.booking.updateMany({
      where: {
        id: { in: payable.map((booking) => booking.id) },
        pnr,
        status: "PENDING",
        trip: { time: { gt: paidAt } },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: paidAt } },
        ],
      },
      data: {
        status: "CONFIRMED",
        confirmedAt: paidAt,
        expiresAt: null,
      },
    });

    if (updated.count !== payable.length) {
      throw new BusinessError(
        "Vé đã hết hạn hoặc thay đổi trạng thái. Vui lòng tải lại trang.",
        409,
      );
    }
    // Ghế đã trừ khi đặt vé nên không trừ lần nữa khi thanh toán.
    return { status: "SUCCESS", bookingStatus: "CONFIRMED" };
  });
}
