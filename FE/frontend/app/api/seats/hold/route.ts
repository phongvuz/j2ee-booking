import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { holdSeat, releaseSeat } from "@/services/seatService";
import { broadcastSeatRefresh } from "@/lib/sse";
import { normalizeSeat } from "@/lib/seats";
import { apiError, readJson } from "@/lib/admin-api";
import { tripIdSchema } from "@/lib/trip-id";
import { requireSeatOwner } from "@/lib/seat-session";
import { realtimeClientIdSchema } from "@/lib/validations/seat-realtime";
import { isSameOriginRequest } from "@/lib/request-origin";
import { BusinessError } from "@/lib/business-error";

const schema = z.object({
  tripId: tripIdSchema,
  seatNumber: z.string().trim().min(2).max(5),
  clientId: realtimeClientIdSchema,
  action: z.enum(["hold", "release"]),
});

export async function POST(request: NextRequest) {
  try {
    if (!isSameOriginRequest(request)) throw new BusinessError("Nguồn yêu cầu không hợp lệ.", 403);
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) return NextResponse.json({ success: false, message: "Thông tin giữ ghế không hợp lệ." }, { status: 400 });
    const { tripId, clientId, action } = parsed.data;
    const seatNumber = normalizeSeat(parsed.data.seatNumber);
    const ownerKey = requireSeatOwner(request, clientId);
    if (action === "hold") await holdSeat(tripId, seatNumber, ownerKey);
    else await releaseSeat(tripId, seatNumber, ownerKey);
    broadcastSeatRefresh(tripId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, "Không thể cập nhật giữ ghế lúc này.");
  }
}
