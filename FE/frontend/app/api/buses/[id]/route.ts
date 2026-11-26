import { requireAdmin, apiError, readJson } from "@/lib/admin-api";
import { NextRequest, NextResponse } from "next/server";
import { getBusById, updateBus, deleteBus, checkBusPlateConflict } from "@/services/busService";
import { busSchema } from "@/lib/validations/bus";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ParamsContext = {
  params: Promise<{ id: string }>;
};

// GET /api/buses/[id] - Xem chi tiết xe
export async function GET(request: NextRequest, { params }: ParamsContext) {
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

    return NextResponse.json({
      success: true,
      data: bus,
    });
  } catch (error) {
    return apiError(error, "Không thể xử lý yêu cầu lúc này. Vui lòng thử lại.");
  }
}

// PUT /api/buses/[id] - Cập nhật thông tin xe
export async function PUT(request: NextRequest, { params }: ParamsContext) {
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

    const validationResult = busSchema.safeParse(body);
    if (!validationResult.success) {
      const errorMessage = validationResult.error.issues
        .map((i) => i.message)
        .join(", ");
      return NextResponse.json(
        {
          success: false,
          message: errorMessage || "Dữ liệu cập nhật không hợp lệ",
          errors: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const validData = validationResult.data;

    // Kiểm tra trùng biển số với xe khác
    const plateConflict = await checkBusPlateConflict(validData.plate, bus.id);
    if (plateConflict) {
      return NextResponse.json(
        {
          success: false,
          message: `Biển số xe "${validData.plate}" đã thuộc về xe khác trong hệ thống.`,
        },
        { status: 409 }
      );
    }

    const updated = await updateBus(bus.id, validData);

    return NextResponse.json({
      success: true,
      message: `Cập nhật thông tin xe ${bus.plate} thành công!`,
      data: updated,
    });
  } catch (error) {
    return apiError(error, "Không thể xử lý yêu cầu lúc này. Vui lòng thử lại.");
  }
}

// DELETE /api/buses/[id] - Xóa xe
export async function DELETE(request: NextRequest, { params }: ParamsContext) {
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

    const deleted = await deleteBus(bus.id);
    if (!deleted) {
      return NextResponse.json(
        { success: false, message: `Không thể xóa xe ${id}.` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Đã xóa xe biển số ${bus.plate} (${bus.id}) thành công!`,
    });
  } catch (error) {
    return apiError(error, "Không thể xử lý yêu cầu lúc này. Vui lòng thử lại.");
  }
}
