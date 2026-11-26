import { NextRequest, NextResponse } from "next/server";
import { createBooking, getBookings } from "@/services/bookingService";
import { onlineOrderSchema } from "@/lib/validations/order";
import { apiError, readJson } from "@/lib/admin-api";
import { getCurrentCustomer } from "@/lib/session";
import { requireSeatOwner } from "@/lib/seat-session";
import { isSameOriginRequest } from "@/lib/request-origin";
import { BusinessError } from "@/lib/business-error";
import { bookingLookupSource, checkBookingLookupLimit } from "@/lib/booking-lookup-limit";

export async function POST(request: NextRequest) {
  try {
    if (!isSameOriginRequest(request)) throw new BusinessError("Nguồn yêu cầu không hợp lệ.", 403);
    const parsed = onlineOrderSchema.safeParse(await readJson(request));
    if (!parsed.success) return NextResponse.json({ success: false, message: parsed.error.issues.map((issue) => issue.message).join(", ") }, { status: 400 });
    const customer = await getCurrentCustomer();
    const { clientId, ...booking } = parsed.data;
    const result = await createBooking({
      ...booking,
      holdOwnerKey: clientId
        ? requireSeatOwner(request, clientId)
        : undefined,
      ownerId: customer?.userId,
      status: "PENDING",
      isOnline: true,
    });
    return NextResponse.json({ success: true, message: "Đã ghi nhận đặt chỗ, chờ thanh toán.", data: result }, { status: 201 });
  } catch (error) {
    return apiError(error, "Không thể đặt vé lúc này. Vui lòng thử lại.");
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pnr = searchParams.get("pnr")?.trim() ?? "";
    const phone = searchParams.get("phone")?.trim() ?? "";
    // Invalid input is rejected by the service without consuming shared limits.
    if (pnr && pnr.length <= 191 && /^(?:0|\+84)[0-9]{9}$/.test(phone)) {
      const limit = checkBookingLookupLimit(phone, bookingLookupSource(request));
      if (!limit.allowed) {
        return NextResponse.json({ success: false, message: "Bạn tra cứu quá nhiều lần. Vui lòng thử lại sau." }, {
          status: 429, headers: { "Retry-After": String(limit.retryAfter), "Cache-Control": "no-store" },
        });
      }
    }
    const bookings = await getBookings({ pnr, phone });
    return NextResponse.json({ success: true, count: bookings.length, data: bookings }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const response = apiError(error, "Không thể tra cứu vé lúc này. Vui lòng thử lại.");
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
