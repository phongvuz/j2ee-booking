import { requireAdmin, apiError, readJson } from "@/lib/admin-api";
import { readOption } from "@/lib/query-params";
import { parseTripId } from "@/lib/trip-id";
import { NextRequest, NextResponse } from "next/server";
import { offlineOrderSchema } from "@/lib/validations/order";
import { queryOrdersAdmin } from "@/services/orderService";
import { createBooking } from "@/services/bookingService";
import type { OrderQueryParams } from "@/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// READ: GET /api/admin/orders
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const { searchParams } = new URL(request.url);
    let tripId: number | undefined;
    if (searchParams.has("tripId")) {
      tripId = parseTripId(searchParams.get("tripId")!);
    }
    const params: OrderQueryParams = {
      search: searchParams.get("search") ?? "",
      status: searchParams.get("status") ?? "",
      date: searchParams.get("date") ?? "",
      tripId,
      page: Number(searchParams.get("page") ?? 1),
      limit: Number(searchParams.get("limit") ?? 10),
      sortBy: readOption(searchParams.get("sortBy"), ["createdAt", "totalPrice", "id"] as const, "id"),
      sortOrder: readOption(searchParams.get("sortOrder"), ["asc", "desc"] as const, "desc"),
    };
    const { data, pagination, stats } = await queryOrdersAdmin(params);

    return NextResponse.json(
      { success: true, data, pagination, stats, message: "Lấy danh sách đơn hàng thành công." },
      { status: 200 }
    );
  } catch (error) {
    return apiError(error, "Không thể lấy danh sách đơn hàng. Vui lòng thử lại.");
  }
}

// CREATE: POST /api/admin/orders
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    const body = await readJson(request);
    const validationResult = offlineOrderSchema.safeParse(body);

    if (!validationResult.success) {
      const issues = validationResult.error.issues;
      return NextResponse.json(
        { success: false, message: issues.map((issue) => issue.message).join(", "), errors: issues },
        { status: 400 }
      );
    }

    const { tripId, seats, fullName, phone, status, paymentMethod } = validationResult.data;
    const bookingResult = await createBooking({ tripId, seats, fullName, phone, status, paymentMethod, actorId: admin.id });

    return NextResponse.json(
      {
        success: true,
        data: bookingResult,
        message: `Đã tạo vé thành công! Mã vé: ${bookingResult.pnr}`,
      },
      { status: 201 }
    );
  } catch (error) {
    return apiError(error, "Không thể tạo vé tại quầy. Vui lòng thử lại.");
  }
}
