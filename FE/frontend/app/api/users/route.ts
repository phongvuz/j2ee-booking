import { requireAdmin, apiError, readJson } from "@/lib/admin-api";
import { readOption } from "@/lib/query-params";
import { NextRequest, NextResponse } from "next/server";
import { queryUsers, createUser, checkUserPhoneConflict } from "@/services/userService";
import { userSchema } from "@/lib/validations/user";
import { UserQueryParams } from "@/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/users - Lấy danh sách người dùng phân trang
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const { searchParams } = new URL(request.url);

    const params: UserQueryParams = {
      search: searchParams.get("search") || "",
      role: searchParams.get("role") || "",
      page: searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : 1,
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 10,
      sortBy: readOption(searchParams.get("sortBy"), ["createdAt", "fullName", "id"] as const, "id"),
      sortOrder: readOption(searchParams.get("sortOrder"), ["asc", "desc"] as const, "desc"),
    };

    const result = await queryUsers(params);

    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      stats: result.stats,
      message: "Lấy danh sách người dùng thành công",
    });
  } catch (error) {
    return apiError(error, "Không thể xử lý yêu cầu lúc này. Vui lòng thử lại.");
  }
}

// POST /api/users - Tạo tài khoản người dùng mới
export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    const body = await readJson(request);

    const validationResult = userSchema.safeParse(body);
    if (!validationResult.success) {
      const issues = validationResult.error.issues;
      const errorMessage = issues.map((i) => i.message).join(", ");
      return NextResponse.json(
        {
          success: false,
          message: errorMessage || "Thông tin người dùng không hợp lệ",
          errors: issues,
        },
        { status: 400 }
      );
    }

    const validData = validationResult.data;

    // Kiểm tra trùng SĐT
    const phoneExists = await checkUserPhoneConflict(validData.phone);
    if (phoneExists) {
      return NextResponse.json(
        { success: false, message: `Số điện thoại "${validData.phone}" đã được đăng ký tài khoản.` },
        { status: 409 }
      );
    }

    const newUser = await createUser(validData);

    return NextResponse.json(
      {
        success: true,
        data: {
          id: newUser.id,
          fullName: newUser.fullName,
          phone: newUser.phone,
          role: newUser.role,
          isActive: newUser.isActive,
          createdAt: newUser.createdAt.toISOString(),
        },
        message: `Đã tạo người dùng "${newUser.fullName}" thành công!`,
      },
      { status: 201 }
    );
  } catch (error) {
    return apiError(error, "Không thể xử lý yêu cầu lúc này. Vui lòng thử lại.");
  }
}
