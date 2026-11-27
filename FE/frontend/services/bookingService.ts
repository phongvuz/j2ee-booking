import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { BusinessError } from "@/lib/business-error";
import { hashPassword } from "@/lib/password";
import { runTransaction } from "@/lib/transaction";
import { getSeatCodes, normalizeSeat } from "@/lib/seats";
import { positiveInteger } from "@/lib/query-params";
import { assertTripId } from "@/lib/trip-id";
import { assertTripPrice } from "@/lib/money";
import { broadcastSeatRefresh } from "@/lib/sse";
import { createGuestPhone } from "@/lib/guest-account";
import type { CreateBookingInput, BookingResult } from "@/types";

class BookingConflictError extends BusinessError {
  constructor(public conflictingSeats: string[]) {
    super(
      `Ghế ${conflictingSeats.join(", ")} đã được đặt hoặc đang được giữ. Vui lòng chọn ghế khác.`,
      409,
    );
    this.name = "BookingConflictError";
  }
}
class TripNotFoundError extends BusinessError {
  constructor(tripId: number) {
    super(`Không tìm thấy chuyến xe với mã: ${tripId}`, 404);
    this.name = "TripNotFoundError";
  }
}

export async function createBooking(
  input: CreateBookingInput,
): Promise<BookingResult> {
  const id = assertTripId(input.tripId);
  const seats = input.seats.map(normalizeSeat);
  if (
    !seats.length ||
    seats.length > 5 ||
    new Set(seats).size !== seats.length
  ) {
    throw new BusinessError("Mỗi lượt đặt từ 1 đến 5 ghế khác nhau.");
  }
  const status = input.status ?? "PENDING";
  if (status === "CANCELLED")
    throw new BusinessError("Vé mới phải chờ thanh toán hoặc đã thanh toán.");
  if (status === "CONFIRMED" && !input.actorId) throw new BusinessError("Thu tiền tại quầy cần tài khoản nhân viên xử lý.");
  const fullName = input.fullName.trim();
  const phone = input.phone.trim();
  const guestPassword = await hashPassword(randomBytes(32).toString("hex"));

  const result = await runTransaction(async (tx) => {
    const trip = await tx.trip.findUnique({ where: { id }, include: { bus: true } });
    if (!trip) throw new TripNotFoundError(input.tripId);
    assertTripPrice(trip.price);
    const now = new Date();

    if (trip.time <= now || trip.status !== "OPEN") {
      throw new BusinessError(
        "Chuyến xe chưa mở bán hoặc đã xuất bến, không thể đặt thêm vé.",
        409,
      );
    }

    const expiresAt =
      input.isOnline && status === "PENDING"
        ? new Date(
            Math.min(
              now.getTime() + 5 * 60 * 1000,
              trip.time.getTime(),
            ),
          )
        : null;
    const validSeats = getSeatCodes(trip.bus.capacity);
    if (seats.some((seat) => !validSeats.includes(seat))) throw new BusinessError("Ghế đã chọn không thuộc sơ đồ ghế của chuyến xe.");
    const booked = await tx.booking.findMany({ where: { tripId: trip.id, status: { not: "CANCELLED" },
      seatNumber: { in: seats } }, select: { seatNumber: true } });
    const held = await tx.seatHold.findMany({ where: {
      tripId: trip.id, seatNumber: { in: seats }, expiresAt: { gt: new Date() },
      ...(input.holdOwnerKey ? { clientId: { not: input.holdOwnerKey } } : {}),
    }, select: { seatNumber: true } });
    const conflicts = [...new Set([...booked, ...held].map((record) => record.seatNumber))];
    if (conflicts.length) throw new BookingConflictError(conflicts);

    // Điều kiện gte giữ số ghế trống không bao giờ âm.
    const reserved = await tx.trip.updateMany({
      where: { id: trip.id, availableSeats: { gte: seats.length } },
      data: { availableSeats: { decrement: seats.length } },
    });
    if (reserved.count !== 1)
      throw new BusinessError("Chuyến xe không còn đủ ghế trống.", 409);
    let user = input.ownerId ? await tx.user.findUnique({ where: { id: input.ownerId } }) : null;
    if (input.ownerId && !user) throw new BusinessError("Tài khoản đặt vé không còn tồn tại.", 409);
    if (!user)
      user = await tx.user.create({
        data: { fullName, phone: createGuestPhone(), password: guestPassword, role: "USER" },
      });
    const bookings = [];
    for (const seatNumber of seats) {
      bookings.push(
        await tx.booking.create({
          data: {
            seatNumber,
            status,
            totalPrice: trip.price,
            userId: user.id,
            tripId: trip.id,
            passengerName: fullName,
            passengerPhone: phone,
            activeSeat: `${trip.id}:${seatNumber}`,
            confirmedAt: status === "CONFIRMED" ? new Date() : null,
            expiresAt,
          },
        }),
      );
    }
    // Một lượt đặt nhiều ghế dùng chung mã PNR, không thay đổi theo tài khoản.
    const pnr = `NHAXE-${trip.id}-${randomBytes(8).toString("hex").toUpperCase()}`;
    await tx.booking.updateMany({
      where: { id: { in: bookings.map((booking) => booking.id) } },
      data: { pnr },
    });
    if (status === "CONFIRMED") {
      const reference = randomBytes(16).toString("hex");
      await tx.bookingTransaction.createMany({ data: bookings.map((booking) => ({
        bookingId: booking.id, kind: "RECEIPT", amount: booking.totalPrice,
        method: input.paymentMethod ?? "CASH", reference, actorId: input.actorId,
      })) });
    }
    await tx.seatHold.deleteMany({
      where: { tripId: trip.id, seatNumber: { in: seats } },
    });
    return {
      pnr,
      tripId: trip.id,
      passenger: { name: fullName, phone },
      seats,
      totalPrice: trip.price * seats.length,
      bookingIds: bookings.map((booking) => booking.id),
    };
  });
  broadcastSeatRefresh(result.tripId);
  return result;
}

interface GetBookingsFilter {
  pnr?: string;
  phone?: string;
  limit?: number;
}
export async function getBookings({
  pnr = "",
  phone = "",
  limit = 50,
}: GetBookingsFilter = {}) {
  const reference = pnr.trim();
  const passengerPhone = phone.trim();
  if (!reference || reference.length > 191 || !/^(?:0|\+84)[0-9]{9}$/.test(passengerPhone))
    throw new BusinessError("Nhập mã đặt chỗ và số điện thoại hợp lệ.");
  const bookings = await prisma.booking.findMany({
    where: { pnr: reference, passengerPhone },
    orderBy: { createdAt: "desc" },
    take: positiveInteger(limit, 50, 100),
    select: {
      id: true,
      pnr: true,
      seatNumber: true,
      status: true,
      totalPrice: true,
      createdAt: true,
      passengerName: true,
      passengerPhone: true,
      trip: {
        select: { id: true, from: true, to: true, time: true, price: true },
      },
    },
  });
  return bookings.map(({ passengerName, passengerPhone, ...booking }) => ({
    ...booking,
    user: { fullName: passengerName, phone: passengerPhone },
  }));
}
