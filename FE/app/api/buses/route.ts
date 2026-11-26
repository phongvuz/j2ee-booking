import { requireAdmin, apiError, readJson } from "@/lib/admin-api";
import { readOption } from "@/lib/query-params";
import { NextRequest, NextResponse } from "next/server";
import { queryBuses, createBus, checkBusPlateConflict, getSelectableBuses } from "@/services/busService";
import { busSchema } from "@/lib/validations/bus";
import { BusQueryParams } from "@/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/buses - Lấy danh sách xe với tìm kiếm, lọc và phân trang
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const { searchParams } = new URL(request.url);

    if (searchParams.get("selectable") === "true") {
      return NextResponse.json({ success: true, data: await getSelectableBuses() });
    }

    const params: BusQueryParams = {
      search: searchParams.get("search") || "",
      type: searchParams.get("type") || "",
      status: searchParams.get("status") || "",
      page: searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : 1,
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 10,
      sortBy: readOption(searchParams.get("sortBy"), ["plate", "capacity", "createdAt", "id"] as const, "createdAt"),
      sortOrder: readOption(searchParams.get("sortOrder"), ["asc", "desc"] as const, "desc"),
    };

    const result = await queryBuses(params);

    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      stats: result.stats,
      message: "Lấy danh sách xe thành công",
    });
  } catch (error) {
    return apiError(error, "Không thể xử lý yêu cầu lúc này. Vui lòng thử lại.");
  }
}

// POST /api/buses - Tạo mới xe
export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    const body = await readJson(request);

    const validationResult = busSchema.safeParse(body);
    if (!validationResult.success) {
      const issues = validationResult.error.issues;
      const errorMessage = issues.map((i) => i.message).join(", ");
      return NextResponse.json(
        {
          success: false,
          message: errorMessage || "Dữ liệu thông tin xe không hợp lệ",
          errors: issues,
        },
        { status: 400 }
      );
    }

    const validData = validationResult.data;

    // Kiểm tra trùng biển số xe
    const plateExists = await checkBusPlateConflict(validData.plate);
    if (plateExists) {
      return NextResponse.json(
        { success: false, message: `Biển số xe "${validData.plate.toUpperCase()}" đã tồn tại trong hệ thống.` },
        { status: 409 }
      );
    }

    const newBus = await createBus(validData);

    return NextResponse.json(
      {
        success: true,
        data: newBus,
        message: `Đã thêm xe mới biển số "${newBus.plate}" (${newBus.id}) thành công!`,
      },
      { status: 201 }
    );
  } catch (error) {
    return apiError(error, "Không thể xử lý yêu cầu lúc này. Vui lòng thử lại.");
  }
}
