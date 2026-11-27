import { requireAdmin, apiError, readJson } from "@/lib/admin-api";
import { NextRequest, NextResponse } from "next/server";
import {
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
  checkEmployeeEmailConflict,
  checkEmployeePhoneConflict,
} from "@/services/employeeService";
import { employeeSchema } from "@/lib/validations/employee";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ParamsContext = {
  params: Promise<{ id: string }>;
};

// GET /api/employees/[id] - Xem chi tiết nhân viên
export async function GET(request: NextRequest, { params }: ParamsContext) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const employee = await getEmployeeById(id);

    if (!employee) {
      return NextResponse.json(
        { success: false, message: `Không tìm thấy nhân viên có mã ${id}` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: employee,
    });
  } catch (error) {
    return apiError(error, "Không thể xử lý yêu cầu lúc này. Vui lòng thử lại.");
  }
}

// PUT /api/employees/[id] - Cập nhật thông tin nhân viên
export async function PUT(request: NextRequest, { params }: ParamsContext) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const employee = await getEmployeeById(id);

    if (!employee) {
      return NextResponse.json(
        { success: false, message: `Không tìm thấy nhân viên có mã ${id}` },
        { status: 404 }
      );
    }

    const body = await readJson(request);

    // Validate with Zod
    const validationResult = employeeSchema.safeParse(body);
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

    // Check unique email and phone qua tầng Service
    const emailConflict = await checkEmployeeEmailConflict(validData.email, id);
    if (emailConflict) {
      return NextResponse.json(
        {
          success: false,
          message: `Email "${validData.email}" đã được sử dụng bởi nhân viên khác.`,
        },
        { status: 409 }
      );
    }

    const phoneConflict = await checkEmployeePhoneConflict(validData.phone, id);
    if (phoneConflict) {
      return NextResponse.json(
        {
          success: false,
          message: `Số điện thoại "${validData.phone}" đã được sử dụng bởi nhân viên khác.`,
        },
        { status: 409 }
      );
    }

    const updated = await updateEmployee(id, {
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

    return NextResponse.json({
      success: true,
      message: `Cập nhật thông tin nhân viên ${id} thành công!`,
      data: updated,
    });
  } catch (error) {
    return apiError(error, "Không thể xử lý yêu cầu lúc này. Vui lòng thử lại.");
  }
}

// DELETE /api/employees/[id] - Xóa nhân viên
export async function DELETE(request: NextRequest, { params }: ParamsContext) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const employee = await getEmployeeById(id);

    if (!employee) {
      return NextResponse.json(
        { success: false, message: `Không tìm thấy nhân viên có mã ${id}` },
        { status: 404 }
      );
    }

    const deleted = await deleteEmployee(id);
    if (!deleted) {
      return NextResponse.json(
        { success: false, message: `Không thể xóa nhân viên ${id}.` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Đã xóa nhân viên ${employee.name} (${id}) thành công!`,
    });
  } catch (error) {
    return apiError(error, "Không thể xử lý yêu cầu lúc này. Vui lòng thử lại.");
  }
}
