import { NextRequest, NextResponse } from "next/server";
import { apiError, readJson } from "@/lib/admin-api";
import { BusinessError } from "@/lib/business-error";
import { prisma } from "@/lib/prisma";
import { getSeatCodes } from "@/lib/seats";
import { applySeatInteraction, synchronizeClientSeats } from "@/lib/sse";
import { parseTripId } from "@/lib/trip-id";
import { seatInteractionRequestSchema, seatSyncRequestSchema } from "@/lib/validations/seat-realtime";
import { requireSeatOwner } from "@/lib/seat-session";
import { isSameOriginRequest } from "@/lib/request-origin";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ id: string }> };

async function validateTripSeats(tripId: number, seatNumbers: string[], selectingSeats: boolean) {
  const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { bus: { select: { capacity: true } }, time: true } });
  if (!trip) throw new BusinessError("Không tìm thấy chuyến xe.", 404);
  const validSeats = getSeatCodes(trip.bus.capacity);
  if (seatNumbers.some((seatNumber) => !validSeats.includes(seatNumber))) {
    throw new BusinessError("Ghế không thuộc sơ đồ của chuyến xe.");
  }
  if (!selectingSeats) return;
  if (trip.time <= new Date()) throw new BusinessError("Chuyến xe đã xuất bến.", 409);
  const bookedSeat = await prisma.booking.findFirst({
    where: { tripId, seatNumber: { in: seatNumbers }, status: { not: "CANCELLED" } },
    select: { seatNumber: true },
  });
  if (bookedSeat) throw new BusinessError(`Ghế ${bookedSeat.seatNumber} đã có vé. Vui lòng tải lại trang.`, 409);
}

function validateTripMatch(urlTripId: number, bodyTripId: number) {
  if (urlTripId !== bodyTripId) throw new BusinessError("ID chuyến xe trong URL và dữ liệu không khớp.");
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    if (!isSameOriginRequest(request)) throw new BusinessError("Nguồn yêu cầu không hợp lệ.", 403);
    const { id } = await params;
    const tripId = parseTripId(id);
    const parsedRequest = seatInteractionRequestSchema.safeParse(await readJson(request));
    if (!parsedRequest.success) throw new BusinessError("Sự kiện chọn ghế không hợp lệ.");
    const seatEvent = parsedRequest.data;
    validateTripMatch(tripId, seatEvent.tripId);
    await validateTripSeats(tripId, [seatEvent.seatNumber], seatEvent.type === "SEAT_SELECTED");
    applySeatInteraction({ ...seatEvent, timestamp: new Date().toISOString() }, requireSeatOwner(request, seatEvent.clientId));
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, "Không thể gửi thao tác chọn ghế.");
  }
}

// Chỉ dùng khi mở hoặc khôi phục kết nối, không gửi mỗi lần React state đổi.
export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    if (!isSameOriginRequest(request)) throw new BusinessError("Nguồn yêu cầu không hợp lệ.", 403);
    const { id } = await params;
    const tripId = parseTripId(id);
    const parsedRequest = seatSyncRequestSchema.safeParse(await readJson(request));
    if (!parsedRequest.success) throw new BusinessError("Danh sách ghế đồng bộ không hợp lệ.");
    const { clientId, selectedSeats, tripId: bodyTripId } = parsedRequest.data;
    validateTripMatch(tripId, bodyTripId);
    await validateTripSeats(tripId, selectedSeats, selectedSeats.length > 0);
    synchronizeClientSeats(tripId, clientId, selectedSeats, requireSeatOwner(request, clientId));
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, "Không thể đồng bộ lựa chọn ghế.");
  }
}
