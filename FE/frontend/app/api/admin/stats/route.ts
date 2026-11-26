import { requireAdmin, apiError } from "@/lib/admin-api";
import { NextResponse } from "next/server";
import { getDashboardStats } from "@/services/dashboardService";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/admin/stats - Thống kê tổng hợp cho Admin Dashboard
export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const stats = await getDashboardStats();

    return NextResponse.json({
      success: true,
      data: stats,
      message: "Lấy thống kê hệ thống thành công",
    });
  } catch (error) {
    return apiError(error, "Không thể xử lý yêu cầu lúc này. Vui lòng thử lại.");
  }
}
