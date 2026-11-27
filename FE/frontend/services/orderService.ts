import { BusinessError } from "@/lib/business-error";
import { runTransaction } from "@/lib/transaction";
import { getSeatCodes } from "@/lib/seats";
import { getDepartureDayRange } from "@/lib/trip-search";
import { positiveInteger } from "@/lib/query-params";
import { assertTripId } from "@/lib/trip-id";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { OrderGroup, OrderItem, OrderQueryParams, BookingStatus } from "@/types";
import { toOrderItem } from "@/lib/record-mappers";
import { broadcastSeatRefresh } from "@/lib/sse";
import { getBookingMoney, getMoneySummary } from "@/lib/booking-money";
import { receiveBookingPayment } from "@/services/bookingFinanceService";

const orderInclude = { user: true, trip: true, transactions: { include: { actor: true } } } as const;

export async function queryOrdersAdmin(params: OrderQueryParams) {
  const { search = "", status = "", date = "", tripId, page = 1, limit = 10, sortBy = "id", sortOrder = "desc" } = params;
  const where: Prisma.bookingWhereInput = {};
  if (search.trim()) {
    const value = search.trim();
    const id = Number(value);
    where.OR = [
      ...(Number.isInteger(id) && id > 0 && id <= 2147483647 ? [{ id }, { tripId: id }] : []),
      { pnr: { contains: value } }, { passengerName: { contains: value } },
      { passengerPhone: { contains: value } }, { seatNumber: { contains: value } },
      { user: { fullName: { contains: value } } }, { user: { phone: { contains: value } } },
      { trip: { from: { contains: value } } }, { trip: { to: { contains: value } } },
    ];
  }
  if (status) where.status = status;
  if (tripId !== undefined) where.tripId = assertTripId(tripId);
  if (date) {
    const range = getDepartureDayRange(date);
    if (!range) throw new BusinessError("Ngày lọc không hợp lệ.");
    where.createdAt = range;
  }

  const matches = await prisma.booking.groupBy({ by: ["pnr"], where });
  const pnrs = matches.map((row) => row.pnr).filter((pnr): pnr is string => pnr !== null);
  const groupWhere = { pnr: { in: pnrs } };
  const numLimit = positiveInteger(limit, 10, 100);
  const totalPages = Math.max(1, Math.ceil(pnrs.length / numLimit));
  const validPage = Math.min(positiveInteger(page, 1), totalPages);
  const direction: "asc" | "desc" = sortOrder === "asc" ? "asc" : "desc";
  const orderBy = sortBy === "totalPrice"
    ? [{ _sum: { totalPrice: direction } }, { pnr: "asc" as const }]
    : sortBy === "createdAt"
      ? [{ _min: { createdAt: direction } }, { pnr: "asc" as const }]
      : [{ _min: { id: direction } }, { pnr: "asc" as const }];
  const groups = await prisma.booking.groupBy({
    by: ["pnr"], where: groupWhere, _min: { id: true, createdAt: true }, _sum: { totalPrice: true },
    orderBy, skip: (validPage - 1) * numLimit, take: numLimit,
  });
  const [bookings, positions] = await Promise.all([
    prisma.booking.findMany({ where: { pnr: { in: groups.map((group) => group.pnr!) } }, include: orderInclude, orderBy: { id: "asc" } }),
    prisma.booking.findMany({ where: groupWhere, select: { status: true, totalPrice: true, transactions: { select: { kind: true, amount: true, method: true, reference: true } } } }),
  ]);
  const data: OrderGroup[] = groups.map((group) => {
    const groupBookings = bookings.filter((booking) => booking.pnr === group.pnr);
    const tickets = groupBookings.map(toOrderItem);
    const money = getMoneySummary(groupBookings);
    return {
      pnr: group.pnr!,
      createdAt: group._min.createdAt!.toISOString(),
      totalPrice: group._sum.totalPrice ?? 0,
      ...money,
      tickets,
    };
  });
  const money = getMoneySummary(positions);
  return {
    data,
    pagination: { page: validPage, limit: numLimit, total: pnrs.length, totalPages },
    stats: {
      total: positions.length, orderCount: pnrs.length,
      confirmed: positions.filter((booking) => booking.status === "CONFIRMED").length,
      pending: positions.filter((booking) => booking.status === "PENDING").length,
      cancelled: positions.filter((booking) => booking.status === "CANCELLED").length,
      totalRevenue: money.received - money.refunded, ...money,
    },
  };
}

export async function getOrderById(id: number | string): Promise<OrderItem | null> {
  const orderId = Number(id);
  if (!Number.isInteger(orderId) || orderId <= 0 || orderId > 2147483647) return null;
  const booking = await prisma.booking.findUnique({ where: { id: orderId }, include: orderInclude });
  return booking ? toOrderItem(booking) : null;
}

export async function updateOrderStatus(id: number | string, newStatus: BookingStatus, actorId?: number): Promise<OrderItem | null> {
  const orderId = Number(id);
  if (!Number.isInteger(orderId) || orderId <= 0 || orderId > 2147483647) throw new BusinessError("ID đơn hàng không hợp lệ.");
  if (!["CONFIRMED", "PENDING", "CANCELLED"].includes(newStatus)) throw new BusinessError("Trạng thái vé không hợp lệ.");
  if (newStatus === "CONFIRMED") {
    if (!actorId) throw new BusinessError("Thu tiền cần tài khoản nhân viên xử lý.");
    return await receiveBookingPayment(orderId, "CASH", actorId) ? getOrderById(orderId) : null;
  }
  let changedTripId: number | undefined;
  const changed = await runTransaction(async (tx) => {
    const existing = await tx.booking.findUnique({ where: { id: orderId }, include: { trip: { include: { bus: true } }, transactions: true } });
    if (!existing) return false;
    if (existing.status === newStatus) return true;
    if (existing.status === "CONFIRMED" && newStatus === "PENDING") throw new BusinessError("Vé đã xác nhận không thể chuyển về chờ thanh toán.", 409);
    if (existing.trip.time <= new Date()) throw new BusinessError("Chuyến xe đã xuất bến. Không thể hủy hoặc khôi phục vé.", 409);
    let status: BookingStatus = newStatus;
    if (existing.status === "CANCELLED") {
      if (existing.trip.status !== "OPEN") throw new BusinessError("Chuyến xe chưa mở bán. Không thể khôi phục vé.", 409);
      const money = getBookingMoney(existing.totalPrice, existing.status, existing.transactions);
      if (money.received - money.refunded >= existing.totalPrice) status = "CONFIRMED";
      if (status !== "CONFIRMED" && existing.expiresAt && existing.expiresAt <= new Date()) throw new BusinessError("Vé đã hết hạn. Vui lòng đặt vé mới.", 409);
      if (!getSeatCodes(existing.trip.bus.capacity).includes(existing.seatNumber)) throw new BusinessError("Ghế không còn thuộc sơ đồ hiện tại.", 409);
      const conflict = await tx.booking.findFirst({ where: { activeSeat: `${existing.tripId}:${existing.seatNumber}` } });
      const held = await tx.seatHold.findFirst({ where: { tripId: existing.tripId, seatNumber: existing.seatNumber, expiresAt: { gt: new Date() } } });
      if (conflict || held) throw new BusinessError("Ghế này đã được đặt hoặc đang được giữ.", 409);
      const reserved = await tx.trip.updateMany({ where: { id: existing.tripId, availableSeats: { gt: 0 } }, data: { availableSeats: { decrement: 1 } } });
      if (reserved.count !== 1) throw new BusinessError("Chuyến xe đã hết ghế.", 409);
    }
    await tx.booking.update({ where: { id: orderId }, data: {
      status, activeSeat: status === "CANCELLED" ? null : `${existing.tripId}:${existing.seatNumber}`,
    } });
    if (existing.status !== "CANCELLED" && status === "CANCELLED") {
      await tx.trip.update({ where: { id: existing.tripId }, data: { availableSeats: { increment: 1 } } });
    }
    changedTripId = existing.tripId;
    return true;
  });
  if (changed && changedTripId !== undefined) broadcastSeatRefresh(changedTripId);
  return changed ? getOrderById(orderId) : null;
}

export async function deleteOrder(id: number | string): Promise<boolean> {
  return Boolean(await updateOrderStatus(id, "CANCELLED"));
}
