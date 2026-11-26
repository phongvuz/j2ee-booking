"use client";

import { UserStats as UserStatsType } from "@/types";

interface UserStatsProps {
  stats: UserStatsType;
}

export function UserStats({ stats }: UserStatsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
          Tổng tài khoản
        </p>
        <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        <p className="text-[11px] text-gray-400 mt-1">Người dùng hệ thống</p>
      </div>

      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
        <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-1">
          Khách hàng (USER)
        </p>
        <p className="text-2xl font-bold text-emerald-700">{stats.users}</p>
        <p className="text-[11px] text-emerald-600 mt-1">Đặt vé trực tuyến</p>
      </div>

      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
        <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider mb-1">
          Quản trị (ADMIN)
        </p>
        <p className="text-2xl font-bold text-purple-700">{stats.admins}</p>
        <p className="text-[11px] text-purple-600 mt-1">Có quyền quản lý</p>
      </div>

      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
        <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">
          Đăng ký tháng này
        </p>
        <p className="text-2xl font-bold text-blue-700">{stats.newThisMonth}</p>
        <p className="text-[11px] text-blue-600 mt-1">Tài khoản mới</p>
      </div>
    </div>
  );
}
