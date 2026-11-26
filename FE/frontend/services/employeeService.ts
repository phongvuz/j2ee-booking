import { randomBytes } from "node:crypto";
import { hasDatabaseCode } from "@/lib/business-error";
import { formatDepartureDate } from "@/lib/trip-search";
import { positiveInteger } from "@/lib/query-params";
import { toEmployee } from "@/lib/record-mappers";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Employee, EmployeeQueryParams, PaginationMeta, EmployeeStats } from "@/types";
import { runTransaction } from "@/lib/transaction";
import { BusinessError } from "@/lib/business-error";

/**
 * Lấy danh sách nhân viên từ MySQL với bộ lọc, tìm kiếm và phân trang
 */
export async function queryEmployees(params: EmployeeQueryParams): Promise<{
  data: Employee[];
  pagination: PaginationMeta;
  stats: EmployeeStats;
}> {
  const {
    search = "",
    role = "",
    department = "",
    status = "",
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = params;

  const where: Prisma.employeeWhereInput = {};

  // 1. Tìm kiếm theo tên, email, sđt, mã nhân viên
  if (search.trim()) {
    const s = search.trim();
    where.OR = [
      { name: { contains: s } },
      { email: { contains: s } },
      { phone: { contains: s } },
      { id: { contains: s } },
    ];
  }

  // 2. Lọc theo chức vụ
  if (role) {
    where.role = role;
  }

  // 3. Lọc theo phòng ban
  if (department) {
    where.department = department;
  }

  // 4. Lọc theo trạng thái
  if (status) {
    where.status = status;
  }

  const numLimit = positiveInteger(limit, 10, 100);
  const numPage = positiveInteger(page, 1);

  const [total, active, onLeave, drivers] = await Promise.all([
    prisma.employee.count({ where }),
    prisma.employee.count({ where: { AND: [where, { status: "Đang làm việc" }] } }),
    prisma.employee.count({ where: { AND: [where, { status: "Nghỉ phép" }] } }),
    prisma.employee.count({ where: { AND: [where, { role: { in: ["Tài xế", "Phụ xe"] } }] } }),
  ]);
  const stats: EmployeeStats = { total, active, onLeave, drivers };
  const totalPages = Math.ceil(total / numLimit) || 1;
  const validPage = Math.min(numPage, totalPages);
  const skip = (validPage - 1) * numLimit;

  // 5. Sắp xếp
  let orderBy: Prisma.employeeOrderByWithRelationInput = {};
  if (sortBy === "name" || sortBy === "createdAt" || sortBy === "id") {
    orderBy[sortBy] = sortOrder === "asc" ? "asc" : "desc";
  } else {
    orderBy = { id: "desc" };
  }

  const employees = await prisma.employee.findMany({
    where,
    orderBy: sortBy === "id" ? orderBy : [orderBy, { id: "desc" }],
    skip,
    take: numLimit,
  });

  const data: Employee[] = employees.map(toEmployee);

  return {
    data,
    stats,
    pagination: {
      page: validPage,
      limit: numLimit,
      total,
      totalPages,
    },
  };
}

/**
 * Tìm kiếm nhân viên theo mã ID
 */
export async function getEmployeeById(id: string): Promise<Employee | null> {
  const emp = await prisma.employee.findUnique({
    where: { id },
  });

  if (!emp) return null;

  return toEmployee(emp);
}

/**
 * Thêm mới một nhân viên vào MySQL
 */
export async function createEmployee(data: {
  name: string;
  email: string;
  phone: string;
  role: string;
  department: string;
  status?: string;
  avatar?: string;
  identityCard?: string;
  address?: string;
  startDate?: string;
}): Promise<Employee> {
  const nextId = `EMP-${randomBytes(6).toString("hex").toUpperCase()}`;

  const now = new Date();

  const created = await prisma.employee.create({
    data: {
      id: nextId,
      name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
      phone: data.phone.trim(),
      role: data.role.trim(),
      department: data.department.trim(),
      status: data.status || "Đang làm việc",
      avatar:
        data.avatar ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(
          data.name
        )}&background=ef5222&color=fff&size=150`,
      identityCard: data.identityCard?.trim() || null,
      address: data.address?.trim() || null,
      startDate: data.startDate || formatDepartureDate(now),
      createdAt: now,
    },
  });

  return toEmployee(created);
}

/**
 * Cập nhật thông tin nhân viên
 */
export async function updateEmployee(
  id: string,
  data: Partial<Omit<Employee, "id" | "createdAt">>
): Promise<Employee | null> {
  const existing = await prisma.employee.findUnique({
    where: { id },
  });

  if (!existing) return null;

  const updateData: Prisma.employeeUpdateInput = {};
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.email !== undefined) updateData.email = data.email.trim().toLowerCase();
  if (data.phone !== undefined) updateData.phone = data.phone.trim();
  if (data.role !== undefined) updateData.role = data.role.trim();
  if (data.department !== undefined) updateData.department = data.department.trim();
  if (data.status !== undefined) updateData.status = data.status;
  if (data.avatar !== undefined) updateData.avatar = data.avatar;
  if (data.identityCard !== undefined) updateData.identityCard = data.identityCard?.trim() || null;
  if (data.address !== undefined) updateData.address = data.address?.trim() || null;
  if (data.startDate !== undefined) updateData.startDate = data.startDate;

  const updated = await runTransaction(async (tx) => {
    const current = await tx.employee.findUnique({ where: { id } });
    if (!current) throw new BusinessError("Nhân viên không còn tồn tại.", 404);
    const cannotDrive = (data.status !== undefined && data.status !== "Đang làm việc") || (data.role !== undefined && data.role !== "Tài xế");
    if (cannotDrive && await tx.trip.count({ where: { driverId: id, status: { in: ["OPEN", "DEPARTED"] } } })) throw new BusinessError("Tài xế đang được phân công cho chuyến mở bán hoặc đang chạy. Đổi tài xế trước khi cập nhật.", 409);
    return tx.employee.update({ where: { id }, data: updateData });
  });

  return toEmployee(updated);
}

/**
 * Xóa nhân viên theo mã ID
 */
export async function deleteEmployee(id: string): Promise<boolean> {
  try {
    await prisma.employee.delete({
      where: { id },
    });
    return true;
  } catch (error) {
    if (!hasDatabaseCode(error, "P2025")) throw error;
    return false;
  }
}

/**
 * Cập nhật trạng thái làm việc của nhân viên
 */
export async function updateEmployeeStatus(
  id: string,
  newStatus: string
): Promise<Employee | null> {
  return updateEmployee(id, { status: newStatus as Employee["status"] });
}

/**
 * Kiểm tra xem email nhân viên đã tồn tại chưa
 */
export async function checkEmployeeEmailConflict(
  email: string,
  excludeId?: string
): Promise<boolean> {
  const existing = await prisma.employee.findFirst({
    where: {
      email: email.trim().toLowerCase(),
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
  });
  return !!existing;
}

/**
 * Kiểm tra xem số điện thoại nhân viên đã tồn tại chưa
 */
export async function checkEmployeePhoneConflict(
  phone: string,
  excludeId?: string
): Promise<boolean> {
  const existing = await prisma.employee.findFirst({
    where: {
      phone: phone.trim(),
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
  });
  return !!existing;
}
