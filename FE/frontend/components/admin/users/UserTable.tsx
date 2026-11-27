"use client";

import { FiEdit, FiEye, FiRefreshCw, FiTrash2, FiUser } from "react-icons/fi";
import { FaCrown } from "react-icons/fa";
import { UserAccount } from "@/types";
import { formatPrice } from "@/lib/trip-display";

interface UserTableProps {
  users: UserAccount[];
  loading: boolean;
  onEdit: (user: UserAccount) => void;
  onDelete: (user: UserAccount) => void;
  onView: (user: UserAccount) => void;
  onToggleRole: (user: UserAccount) => void;
}

export function UserTable({
  users,
  loading,
  onEdit,
  onDelete,
  onView,
  onToggleRole,
}: UserTableProps) {
  if (loading) {
    return (
      <div className="py-16 text-center text-gray-400">
        <div className="inline-block animate-spin text-2xl mb-2"><FiRefreshCw aria-hidden="true" className="inline-block shrink-0 align-middle" /></div>
        <p className="text-xs">Đang tải danh sách người dùng...</p>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="py-16 text-center text-gray-500">
        <span className="text-4xl block mb-2"><FiUser aria-hidden="true" className="inline-block shrink-0 align-middle" /></span>
        <p className="text-sm font-semibold">Không tìm thấy tài khoản nào</p>
        <p className="text-xs text-gray-400 mt-1">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs text-left">
        <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider font-semibold border-b border-gray-200">
          <tr>
            <th className="px-5 py-3.5">Mã ID</th>
            <th className="px-5 py-3.5">Họ và tên</th>
            <th className="px-5 py-3.5">Số điện thoại</th>
            <th className="px-5 py-3.5">Vai trò</th>
            <th className="px-5 py-3.5">Trạng thái</th>
            <th className="px-5 py-3.5">Số đơn đã đặt</th>
            <th className="px-5 py-3.5">Tổng chi tiêu</th>
            <th className="px-5 py-3.5">Ngày tham gia</th>
            <th className="px-5 py-3.5 text-right">Thao tác</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-gray-50/80 transition-colors">
              <td className="px-5 py-3.5 font-bold text-gray-500">#{user.id}</td>
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs">
                    {user.fullName.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-bold text-gray-900">{user.fullName}</span>
                </div>
              </td>
              <td className="px-5 py-3.5 font-semibold text-gray-700">{user.phone || "—"}</td>
              <td className="px-5 py-3.5">
                <button
                  disabled={user.role === "CUSTOMER" || user.isGuest}
                  onClick={() => onToggleRole(user)}
                  title={user.isGuest ? "Khách đặt vé khi chưa đăng nhập" : "Nhấp để đổi quyền giữa USER và ADMIN"}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer transition-transform active:scale-95 ${
                    user.role === "ADMIN"
                      ? "bg-purple-100 text-purple-800 hover:bg-purple-200"
                      : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                  }`}
                >
                  {user.role === "ADMIN" ? <FaCrown aria-hidden="true" className="inline-block shrink-0 align-middle" /> : <FiUser aria-hidden="true" className="inline-block shrink-0 align-middle" />}
                  <span>{user.isGuest ? "Khách vãng lai" : user.role}</span>
                </button>
              </td>
              <td className="px-5 py-3.5">{user.isActive ? "Đang hoạt động" : "Đã khóa"}</td>
              <td className="px-5 py-3.5">
                <span className="font-bold text-gray-900">
                  {user._count?.booking || 0} vé
                </span>
              </td>
              <td className="px-5 py-3.5 font-bold text-brand-primary">
                {formatPrice(user.totalSpent || 0)}
              </td>
              <td className="px-5 py-3.5 text-gray-400">
                {new Date(user.createdAt).toLocaleDateString("vi-VN")}
              </td>
              <td className="px-5 py-3.5 text-right">
                <div className="flex items-center justify-end gap-1.5">
                  <button
                    aria-label="Xem lịch sử đặt vé"
                    onClick={() => onView(user)}
                    className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                    title="Xem lịch sử đặt vé"
                  >
                    <FiEye aria-hidden="true" className="inline-block shrink-0 align-middle" />
                  </button>
                  <button
                    aria-label="Chỉnh sửa tài khoản"
                    disabled={user.isGuest}
                    onClick={() => onEdit(user)}
                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    title={user.isGuest ? "Hồ sơ khách vãng lai chỉ lưu lịch sử vé" : "Chỉnh sửa tài khoản"}
                  >
                    <FiEdit aria-hidden="true" className="inline-block shrink-0 align-middle" />
                  </button>
                  <button
                    aria-label="Xóa người dùng"
                    onClick={() => onDelete(user)}
                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded transition-colors"
                    title="Xóa người dùng"
                  >
                    <FiTrash2 aria-hidden="true" className="inline-block shrink-0 align-middle" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
