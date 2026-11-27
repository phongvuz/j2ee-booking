import { NextRequest, NextResponse } from "next/server";
import { getActiveSeatHolds } from "@/services/seatService";
import { parseTripId } from "@/lib/trip-id";
import { apiError } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { BusinessError } from "@/lib/business-error";
import { deriveSeatOwner, ensureSeatSession } from "@/lib/seat-session";
import { realtimeClientIdSchema } from "@/lib/validations/seat-realtime";
import { getSeatSnapshot } from "@/lib/sse";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tripId = parseTripId(id);
    
    const rawClientId = new URL(request.url).searchParams.get("clientId");
    const parsedClientId = realtimeClientIdSchema.safeParse(rawClientId);
    if (rawClientId !== null && !parsedClientId.success) throw new BusinessError("Mã client không hợp lệ.");
    const clientId = parsedClientId.success ? parsedClientId.data : undefined;
    const session = ensureSeatSession(request);
    const [activeHolds, trip] = await Promise.all([
      getActiveSeatHolds(tripId, clientId ? deriveSeatOwner(session.id, clientId) : undefined),
      prisma.trip.findUnique({ where: { id: tripId }, select: { bus: { select: { capacity: true } }, booking: { where: { status: { not: "CANCELLED" } }, select: { seatNumber: true } } } }),
    ]);
    if (!trip) throw new BusinessError("Không tìm thấy chuyến xe.", 404);
    
    const bookedSeats = trip.booking.map((booking) => booking.seatNumber);
    return NextResponse.json({ success: true, holds: activeHolds, capacity: trip.bus.capacity, bookedSeats, selections: getSeatSnapshot(tripId, bookedSeats).selections }, {
      headers: { "Cache-Control": "no-store", ...(session.cookie ? { "Set-Cookie": session.cookie } : {}) },
    });
  } catch (error) {
    return apiError(error, "Không thể tải ghế đang được giữ lúc này.");
  }
}
