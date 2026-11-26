import { tripSchema } from "@/lib/validations/trip";
import { requireAdmin, apiError, readJson } from "@/lib/admin-api";
import { NextRequest, NextResponse } from "next/server";
import { getTripById, updateTrip, deleteTrip } from "@/services/tripService";
import { parseTripId } from "@/lib/trip-id";

type ParamsContext = {
  params: Promise<{ id: string }>;
};

// GET /api/trips/[id] - Lấy thông tin chi tiết một tuyến xe
export async function GET(_request: NextRequest, { params }: ParamsContext) {
  try {
    const { id } = await params;
    const trip = await getTripById(parseTripId(id));

    if (!trip) {
      return NextResponse.json(
        { success: false, message: `Không tìm thấy tuyến xe có mã ${id}` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: trip,
    });
  } catch (error) {
    return apiError(error, "Không thể xử lý yêu cầu lúc này. Vui lòng thử lại.");
  }
}

// PUT /api/trips/[id] - Cập nhật thông tin tuyến xe
export async function PUT(request: NextRequest, { params }: ParamsContext) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const body = await readJson(request);

    const parsed = tripSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ success: false, message: parsed.error.issues.map((issue) => issue.message).join(", ") }, { status: 400 });
    const updatedTrip = await updateTrip(parseTripId(id), parsed.data);

    if (!updatedTrip) {
      return NextResponse.json(
        { success: false, message: `Không tìm thấy tuyến xe có mã ${id}` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Cập nhật tuyến xe ${id} thành công!`,
      data: updatedTrip,
    });
  } catch (error) {
    return apiError(error, "Không thể xử lý yêu cầu lúc này. Vui lòng thử lại.");
  }
}

// DELETE /api/trips/[id] - Xóa một tuyến xe
export async function DELETE(request: NextRequest, { params }: ParamsContext) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const deletedTrip = await deleteTrip(parseTripId(id));

    if (!deletedTrip) {
      return NextResponse.json(
        { success: false, message: `Không tìm thấy tuyến xe có mã ${id}` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Đã xóa tuyến xe ${id} khỏi cơ sở dữ liệu.`,
      data: deletedTrip,
    });
  } catch (error) {
    return apiError(error, "Không thể xử lý yêu cầu lúc này. Vui lòng thử lại.");
  }
}
