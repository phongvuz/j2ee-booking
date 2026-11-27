import { requireAdmin, apiError, readJson } from "@/lib/admin-api";
import { NextRequest, NextResponse } from "next/server";
import { getUserById, updateUser, deleteUser, checkUserPhoneConflict } from "@/services/userService";
import { userSchema } from "@/lib/validations/user";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ParamsContext = {
  params: Promise<{ id: string }>;
};

// GET /api/users/[id] - Lấy chi tiết tài khoản kèm lịch sử vé
export async function GET(request: NextRequest, { params }: ParamsContext) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const user = await getUserById(id);

    if (!user) {
      return NextResponse.json(
        { success: false, message: `Không tìm thấy người dùng có mã ${id}` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: user,
    });
  } catch (error) {
    return apiError(error, "Không thể xử lý yêu cầu lúc này. Vui lòng thử lại.");
  }
}

// PUT /api/users/[id] - Cập nhật thông tin người dùng
export async function PUT(request: NextRequest, { params }: ParamsContext) {
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

    const validationResult = userSchema.safeParse(body);
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

    // Check phone conflict
    const phoneConflict = await checkUserPhoneConflict(validData.phone, user.id);
    if (phoneConflict) {
      return NextResponse.json(
        {
          success: false,
          message: `Số điện thoại "${validData.phone}" đã được sử dụng bởi người dùng khác.`,
        },
        { status: 409 }
      );
    }

    const updated = await updateUser(user.id, validData, admin.id);

    return NextResponse.json({
      success: true,
      message: `Cập nhật thông tin tài khoản "${updated?.fullName}" thành công!`,
      data: updated,
    });
  } catch (error) {
    return apiError(error, "Không thể xử lý yêu cầu lúc này. Vui lòng thử lại.");
  }
}

// DELETE /api/users/[id] - Xóa tài khoản người dùng
export async function DELETE(request: NextRequest, { params }: ParamsContext) {
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

    const deleted = await deleteUser(user.id, admin.id);
    if (!deleted) {
      return NextResponse.json(
        { success: false, message: `Không thể xóa người dùng mã ${id}.` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Đã xóa tài khoản "${user.fullName}" thành công!`,
    });
  } catch (error) {
    return apiError(error, "Không thể xử lý yêu cầu lúc này. Vui lòng thử lại.");
  }
}
