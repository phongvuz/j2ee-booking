import { hashPassword } from "@/lib/password";
import { BusinessError } from "@/lib/business-error";
import { runTransaction } from "@/lib/transaction";
import { positiveInteger } from "@/lib/query-params";
import { getVietnamMonthStart } from "@/lib/trip-search";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { UserAccount, UserQueryParams, PaginationMeta, UserStats } from "@/types";
import { UserFormValues } from "@/lib/validations/user";
import { isGuestPhone } from "@/lib/guest-account";
import { getMoneySummary } from "@/lib/booking-money";

/**
 * Lấy danh sách người dùng với tìm kiếm, phân trang và thống kê số vé đặt
 */
export async function queryUsers(params: UserQueryParams): Promise<{
  data: UserAccount[];
  pagination: PaginationMeta;
  stats: UserStats;
}> {
  const {
    search = "",
    role = "",
    page = 1,
    limit = 10,
    sortBy = "id",
    sortOrder = "desc",
  } = params;

  const where: Prisma.userWhereInput = {};

  if (search.trim()) {
    const s = search.trim();
    where.OR = [
      { fullName: { contains: s } },
      { phone: { contains: s } },
      { booking: { some: { passengerPhone: { contains: s } } } },
    ];
  }

  if (role) {
    where.role = role;
  }

  const numLimit = positiveInteger(limit, 10, 100);
  const numPage = positiveInteger(page, 1);

  const startOfMonth = getVietnamMonthStart(new Date());
  const [total, roleCounts, newThisMonth] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.groupBy({ by: ["role"], where, _count: { _all: true } }),
    prisma.user.count({ where: { AND: [where, { createdAt: { gte: startOfMonth } }] } }),
  ]);
  const stats: UserStats = {
    total: roleCounts.reduce((sum, group) => sum + group._count._all, 0),
    users: roleCounts.filter((group) => group.role !== "ADMIN").reduce((sum, group) => sum + group._count._all, 0),
    admins: roleCounts.find((group) => group.role === "ADMIN")?._count._all ?? 0,
    newThisMonth,
  };

  const totalPages = Math.ceil(total / numLimit) || 1;
  const validPage = Math.min(numPage, totalPages);
  const skip = (validPage - 1) * numLimit;

  let orderBy: Prisma.userOrderByWithRelationInput = {};
  if (sortBy === "fullName" || sortBy === "createdAt" || sortBy === "id") {
    orderBy[sortBy] = sortOrder === "asc" ? "asc" : "desc";
  } else {
    orderBy = { id: "desc" };
  }

  const users = await prisma.user.findMany({
    where,
    orderBy: sortBy === "id" ? orderBy : [orderBy, { id: "desc" }],
    skip,
    take: numLimit,
    include: {
      _count: {
        select: { booking: true },
      },
      booking: {
        select: { totalPrice: true, status: true, transactions: true },
      },
    },
  });

  const data: UserAccount[] = users.map((u) => {
    const money = getMoneySummary(u.booking, false);
    const totalSpent = money.received - money.refunded;
    return {
      id: u.id,
      fullName: u.fullName,
      phone: isGuestPhone(u.phone) ? "" : u.phone,
      isGuest: isGuestPhone(u.phone),
      role: u.role,
      isActive: u.isActive,
      createdAt: u.createdAt.toISOString(),
      _count: {
        booking: u._count.booking,
      },
      totalSpent,
    };
  });

  return {
    data,
    pagination: {
      page: validPage,
      limit: numLimit,
      total,
      totalPages,
    },
    stats,
  };
}

/**
 * Lấy chi tiết thông tin người dùng kèm lịch sử đặt vé
 */
export async function getUserById(id: number | string) {
  const numId = Number(id);
  if (isNaN(numId)) return null;

  const user = await prisma.user.findUnique({
    where: { id: numId },
    include: {
      booking: {
        orderBy: { createdAt: "desc" },
        include: {
          trip: true,
          transactions: true,
        },
      },
    },
  });

  if (!user) return null;

  const money = getMoneySummary(user.booking, false);
  const totalSpent = money.received - money.refunded;

  return {
    id: user.id,
    fullName: user.fullName,
    phone: isGuestPhone(user.phone) ? "" : user.phone,
    isGuest: isGuestPhone(user.phone),
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
    totalSpent,
    _count: {
      booking: user.booking.length,
    },
    bookings: user.booking.map((b) => ({
      id: b.id,
      seatNumber: b.seatNumber,
      status: b.status,
      totalPrice: b.totalPrice,
      createdAt: b.createdAt.toISOString(),
      trip: {
        id: b.trip.id,
        from: b.trip.from,
        to: b.trip.to,
        time: b.trip.time.toISOString(),
      },
    })),
  };
}

/**
 * Kiểm tra xem số điện thoại đã tồn tại chưa
 */
export async function checkUserPhoneConflict(phone: string, excludeId?: number): Promise<boolean> {
  const existing = await prisma.user.findFirst({
    where: {
      phone: phone.trim(),
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
  });
  return !!existing;
}

const safeUserSelect = { id: true, fullName: true, phone: true, role: true, isActive: true, createdAt: true } as const;

export async function createUser(data: UserFormValues) {
  if (!data.password) throw new BusinessError("Vui lòng nhập mật khẩu cho tài khoản mới.");
  if (data.role === "CUSTOMER") throw new BusinessError("Tài khoản CUSTOMER được tạo qua trang đăng ký khách hàng.");
  return prisma.user.create({
    data: { fullName: data.fullName, phone: data.phone, role: data.role, isActive: data.isActive, password: await hashPassword(data.password) },
    select: safeUserSelect,
  });
}

// Mỗi thao tác đều kiểm tra lại quyền trong transaction, kể cả khi hai admin cùng sửa.
async function checkRoleChange(tx: Prisma.TransactionClient, id: number, role: string, newRole: string, actorId: number, isActive: boolean) {
  if (role === "CUSTOMER" && newRole !== role) throw new BusinessError("Giữ vai trò CUSTOMER để hồ sơ và quyền đăng nhập khách hàng được đồng bộ.", 409);
  if (role !== "CUSTOMER" && newRole === "CUSTOMER") throw new BusinessError("Không thể chuyển vai trò khi chưa có hồ sơ khách hàng.", 409);
  if (role !== "ADMIN" || newRole === "ADMIN" || !isActive) return;
  if (id === actorId) throw new BusinessError("Bạn không thể tự bỏ quyền quản trị đang sử dụng.", 409);
  if (await tx.user.count({ where: { role: "ADMIN", isActive: true } }) <= 1) throw new BusinessError("Phải giữ ít nhất một quản trị viên.", 409);
}

export async function updateUser(id: number | string, data: Partial<UserFormValues>, actorId: number) {
  const password = data.password ? await hashPassword(data.password) : undefined;
  return runTransaction(async (tx) => {
    const current = await tx.user.findUnique({ where: { id: Number(id) }, select: safeUserSelect });
    if (!current) return null;
    if (isGuestPhone(current.phone) && (data.phone !== undefined || data.role !== undefined || data.password)) {
      throw new BusinessError("Hồ sơ khách vãng lai không phải tài khoản đăng nhập. Không thể đổi số điện thoại, vai trò hoặc mật khẩu.", 409);
    }
    await checkRoleChange(tx, current.id, current.role, data.role ?? current.role, actorId, current.isActive);
    if (current.role === "USER" && data.role === "ADMIN" && !data.password) {
      throw new BusinessError("Nhập mật khẩu mới khi cấp quyền quản trị cho hồ sơ khách mua vé.");
    }
    if (data.isActive === false && current.isActive) {
      if (current.id === actorId) throw new BusinessError("Bạn không thể khóa tài khoản đang đăng nhập.", 409);
      if (current.role === "ADMIN" && await tx.user.count({ where: { role: "ADMIN", isActive: true } }) <= 1) throw new BusinessError("Phải giữ ít nhất một quản trị viên đang hoạt động.", 409);
    }
    if (current.role === "CUSTOMER") {
      const customer = await tx.customer.findUnique({ where: { phone: current.phone } });
      if (!customer) throw new BusinessError("Tài khoản đang thiếu hồ sơ khách hàng. Cần kiểm tra dữ liệu trước khi cập nhật.", 409);
      await tx.customer.update({ where: { id: customer.id }, data: { name: data.fullName, phone: data.phone, status: data.isActive === undefined ? undefined : data.isActive ? "Đang hoạt động" : "Ngừng hoạt động" } });
    }
    const updated = await tx.user.update({ where: { id: current.id }, data: { fullName: data.fullName, phone: data.phone, role: data.role, isActive: data.isActive, password }, select: safeUserSelect });
    return { ...updated, phone: isGuestPhone(updated.phone) ? "" : updated.phone, isGuest: isGuestPhone(updated.phone) };
  });
}

export async function deleteUser(id: number | string, actorId: number): Promise<boolean> {
  return runTransaction(async (tx) => {
    const current = await tx.user.findUnique({ where: { id: Number(id) }, select: safeUserSelect });
    if (!current) return false;
    if (current.id === actorId) throw new BusinessError("Bạn không thể xóa tài khoản đang đăng nhập.", 409);
    await checkRoleChange(tx, current.id, current.role, current.role === "CUSTOMER" ? "CUSTOMER" : "USER", actorId, current.isActive);
    if (await tx.booking.count({ where: { userId: current.id } })) throw new BusinessError("Tài khoản có lịch sử vé, không thể xóa.", 409);
    if (current.role === "CUSTOMER") await tx.customer.deleteMany({ where: { phone: current.phone } });
    await tx.user.delete({ where: { id: current.id } });
    return true;
  });
}

export async function updateUserRole(id: number | string, newRole: "USER" | "ADMIN", actorId: number) {
  return updateUser(id, { role: newRole }, actorId);
}
