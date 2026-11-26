import { requireAdmin, apiError, readJson } from "@/lib/admin-api";
import { NextRequest, NextResponse } from "next/server";
import { getUserById, updateUserRole } from "@/services/userService";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ParamsContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, { params }: ParamsContext) {
  try {
    const admin = await requireAdmin(request);
    const { id } = await params;
    const user = await getUserById(id);

    if (!user) {
      return NextResponse.json(
        { success: false, message: `Không tìm thấy người dùng có mã ${id}` },
        { status: 404 }
      );
    }

    const body = await readJson(request);
    const { role } = (body ?? {}) as { role?: string };

    if (role !== "USER" && role !== "ADMIN") {
      return NextResponse.json(
        { success: false, message: "Vai trò chỉ được là 'USER' hoặc 'ADMIN'" },
        { status: 400 }
      );
    }

    const updated = await updateUserRole(user.id, role, admin.id);

    return NextResponse.json({
      success: true,
      message: `Đã cập nhật quyền của "${user.fullName}" thành "${role}"!`,
      data: updated,
    });
  } catch (error) {
    return apiError(error, "Không thể xử lý yêu cầu lúc này. Vui lòng thử lại.");
  }
}
