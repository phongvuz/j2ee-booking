import { requireAdmin, apiError, readJson } from "@/lib/admin-api";
import { getOrderById, updateOrderStatus, deleteOrder } from "@/services/orderService";
import { NextRequest, NextResponse } from "next/server";
import type { BookingStatus } from "@/types";

// Bài thực hành: docs/exercises/orders/README.md
export const dynamic = "force-dynamic";
export const revalidate = 0;

type ParamsContext = {
  params: Promise<{ id: string }>;
};

// READ: GET /api/admin/orders/[id]
export async function GET(request: NextRequest, { params }: ParamsContext) {
  try {
    await requireAdmin(request);
    const { id } = await params;

    // 1. ID chỉ gồm chữ số, có giá trị từ 1 đến 2147483647 (giới hạn của database).
    const orderId = Number(id);
    if (!/^[0-9]+$/.test(id) || !Number.isInteger(orderId) || orderId <= 0 || orderId > 2147483647) {
      return NextResponse.json(
        { success: false, message: "ID đơn hàng không hợp lệ." },
        { status: 400 }
      );
    }

    // 2. Tìm đơn hàng theo ID; không tìm thấy thì trả lỗi 404.
    const order = await getOrderById(orderId);
    if (!order) {
      return NextResponse.json(
        { success: false, message: "Không tìm thấy đơn hàng." },
        { status: 404 }
      );
    }

    // 3. Trả thông tin đơn hàng cho phía gọi API.
    return NextResponse.json(
      { success: true, data: order },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return apiError(error, "Không thể lấy chi tiết đơn hàng. Vui lòng thử lại.");
  }
}

// UPDATE: PATCH /api/admin/orders/[id]
export async function PATCH(request: NextRequest, { params }: ParamsContext) {
  try {
    const admin = await requireAdmin(request);
    const { id } = await params;

    // 1. Kiểm tra ID trước khi đọc dữ liệu cần cập nhật.
    const orderId = Number(id);
    if (!/^[0-9]+$/.test(id) || !Number.isInteger(orderId) || orderId <= 0 || orderId > 2147483647) {
      return NextResponse.json(
        { success: false, message: "ID đơn hàng không hợp lệ." },
        { status: 400 }
      );
    }

    // 2. Đọc JSON và kiểm tra trạng thái mới.
    const body = await readJson(request);
    let status: unknown;
    if (body && typeof body === "object" && "status" in body) {
      status = body.status;
    }
    const allowedStatuses: BookingStatus[] = ["CONFIRMED", "PENDING", "CANCELLED"];

    if (typeof status !== "string" || !allowedStatuses.includes(status as BookingStatus)) {
      return NextResponse.json(
        { success: false, message: `Trạng thái không hợp lệ. Cho phép: ${allowedStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    const updated = await updateOrderStatus(orderId, status as BookingStatus, admin.id);
    if (!updated) {
      return NextResponse.json(
        { success: false, message: "Không tìm thấy đơn hàng." },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { success: true, data: updated, message: "Cập nhật trạng thái đơn hàng thành công." },
      { status: 200 }
    );
  } catch (error) {
    return apiError(error, "Không thể cập nhật trạng thái đơn hàng. Vui lòng thử lại.");
  }
}

// DELETE: DELETE /api/admin/orders/[id] (hủy vé và giữ lịch sử)
export async function DELETE(request: NextRequest, { params }: ParamsContext) {
  try {
    await requireAdmin(request);
    const { id } = await params;

    // 1. Kiểm tra ID đơn hàng.
    const orderId = Number(id);
    if (!/^[0-9]+$/.test(id) || !Number.isInteger(orderId) || orderId <= 0 || orderId > 2147483647) {
      return NextResponse.json(
        { success: false, message: "ID đơn hàng không hợp lệ." },
        { status: 400 }
      );
    }

    const deleted = await deleteOrder(orderId);
    if (!deleted) {
      return NextResponse.json(
        { success: false, message: "Đơn hàng không còn tồn tại." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: true, message: "Hủy đơn hàng thành công." },
      { status: 200 }
    );
  } catch (error) {
    return apiError(error, "Không thể hủy đơn hàng. Vui lòng thử lại.");
  }
}
