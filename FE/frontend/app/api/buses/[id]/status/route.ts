import { requireAdmin, apiError, readJson } from "@/lib/admin-api";
import { NextRequest, NextResponse } from "next/server";
import { getBusById, updateBusStatus } from "@/services/busService";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ParamsContext = {
  params: Promise<{ id: string }>;
};

// PATCH /api/buses/[id]/status - Cập nhật trạng thái hoạt động của xe
export async function PATCH(request: NextRequest, { params }: ParamsContext) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const bus = await getBusById(id);

    if (!bus) {
      return NextResponse.json(
        { success: false, message: `Không tìm thấy xe có mã ${id}` },
        { status: 404 }
      );
    }

    const body = await readJson(request);
    const { status } = (body ?? {}) as { status?: string };

    const allowedStatuses = ["Đang hoạt động", "Bảo dưỡng", "Ngừng hoạt động"];
    if (!status || !allowedStatuses.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          message: `Trạng thái không hợp lệ. Cho phép: ${allowedStatuses.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const updated = await updateBusStatus(bus.id, status);

    return NextResponse.json({
      success: true,
      message: `Đã chuyển trạng thái xe "${bus.plate}" sang "${status}"!`,
      data: updated,
    });
  } catch (error) {
    return apiError(error, "Không thể xử lý yêu cầu lúc này. Vui lòng thử lại.");
  }
}
