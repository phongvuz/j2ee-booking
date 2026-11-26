import { requireAdmin, apiError, readJson } from "@/lib/admin-api";
import { readOption } from "@/lib/query-params";
import { NextRequest, NextResponse } from "next/server";
import {
  queryEmployees,
  createEmployee,
  checkEmployeeEmailConflict,
  checkEmployeePhoneConflict,
} from "@/services/employeeService";
import { employeeSchema } from "@/lib/validations/employee";
import { EmployeeQueryParams } from "@/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/employees - Lấy danh sách nhân viên có phân trang, tìm kiếm và lọc
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const { searchParams } = new URL(request.url);

    const params: EmployeeQueryParams = {
      search: searchParams.get("search") || "",
      role: searchParams.get("role") || "",
      department: searchParams.get("department") || "",
      status: searchParams.get("status") || "",
      page: searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : 1,
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 10,
      sortBy: readOption(searchParams.get("sortBy"), ["name", "createdAt", "id"] as const, "createdAt"),
      sortOrder: readOption(searchParams.get("sortOrder"), ["asc", "desc"] as const, "desc"),
    };

    const result = await queryEmployees(params);

    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      stats: result.stats,
      message: "Lấy danh sách nhân viên thành công",
    });
  } catch (error) {
    return apiError(error, "Không thể xử lý yêu cầu lúc này. Vui lòng thử lại.");
  }
}

// POST /api/employees - Tạo mới một nhân viên
export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    const body = await readJson(request);

    // Validate payload with Zod
    const validationResult = employeeSchema.safeParse(body);
    if (!validationResult.success) {
      const issues = validationResult.error.issues;
      const errorMessage = issues.map((i) => i.message).join(", ");
      return NextResponse.json(
        {
          success: false,
          message: errorMessage || "Dữ liệu không hợp lệ",
          errors: issues,
        },
        { status: 400 }
      );
    }

    const validData = validationResult.data;

    // Check duplicate email / phone qua tầng Service
    const emailExists = await checkEmployeeEmailConflict(validData.email);
    if (emailExists) {
      return NextResponse.json(
        { success: false, message: `Email "${validData.email}" đã tồn tại trên hệ thống.` },
        { status: 409 }
      );
    }

    const phoneExists = await checkEmployeePhoneConflict(validData.phone);
    if (phoneExists) {
      return NextResponse.json(
        { success: false, message: `Số điện thoại "${validData.phone}" đã được sử dụng.` },
        { status: 409 }
      );
    }

    const newEmployee = await createEmployee({
      name: validData.name,
      email: validData.email,
      phone: validData.phone,
      role: validData.role,
      department: validData.department,
      status: validData.status,
      identityCard: validData.identityCard,
      address: validData.address,
      startDate: validData.startDate,
    });

    return NextResponse.json(
      {
        success: true,
        data: newEmployee,
        message: `Đã thêm nhân viên "${newEmployee.name}" (${newEmployee.id}) thành công!`,
      },
      { status: 201 }
    );
  } catch (error) {
    return apiError(error, "Không thể xử lý yêu cầu lúc này. Vui lòng thử lại.");
  }
}
