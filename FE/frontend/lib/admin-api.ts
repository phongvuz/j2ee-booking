import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { isSameOriginRequest } from "@/lib/request-origin";
import { BusinessError, hasDatabaseCode } from "@/lib/business-error";

export async function requireAdmin(request?: Request) {
  const user = await getCurrentUser("admin");
  const isMutation = request && !["GET", "HEAD"].includes(request.method);
  if (isMutation && !isSameOriginRequest(request)) {
    throw new BusinessError("Nguồn yêu cầu không hợp lệ.", 403);
  }
  if (!user) {
    if (!request) {
      redirect("/admin/login");
    }
    throw new BusinessError("Vui lòng đăng nhập để tiếp tục!", 401);
  }
  if (user.role !== "ADMIN") {
    if (!request) {
      redirect("/admin/login");
    }
    throw new BusinessError("Bạn không có quyền quản trị!", 403);
  }
  return user;
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new BusinessError("Dữ liệu JSON không hợp lệ.");
  }
}

export function apiError(error: unknown, fallback: string) {
  if (error instanceof BusinessError) {
    return NextResponse.json({ success: false, message: error.message }, { status: error.status });
  }
  if (hasDatabaseCode(error, "P2002")) {
    return NextResponse.json({ success: false, message: "Dữ liệu bị trùng. Vui lòng kiểm tra lại thông tin hoặc ghế đã chọn." }, { status: 409 });
  }
  if (hasDatabaseCode(error, "P2003")) {
    return NextResponse.json({ success: false, message: "Dữ liệu đang được sử dụng. Không thể xóa lịch sử liên quan." }, { status: 409 });
  }
  if (hasDatabaseCode(error, "P2025")) {
    return NextResponse.json({ success: false, message: "Dữ liệu không còn tồn tại." }, { status: 404 });
  }
  if (hasDatabaseCode(error, "P2034")) {
    return NextResponse.json({ success: false, message: "Dữ liệu vừa thay đổi. Vui lòng tải lại và thử lại." }, { status: 409 });
  }
  console.error(fallback, error);
  return NextResponse.json({ success: false, message: fallback }, { status: 500 });
}
