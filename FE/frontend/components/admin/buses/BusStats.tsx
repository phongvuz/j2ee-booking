"use client";

import { BusStats as BusStatsType } from "@/types";

interface BusStatsProps {
  stats: BusStatsType;
  total: number;
}

export function BusStats({ stats, total }: BusStatsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
          Tổng số xe
        </p>
        <p className="text-2xl font-bold text-gray-900">{total}</p>
        <p className="text-[11px] text-gray-400 mt-1">Đội xe công ty</p>
      </div>

      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
        <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-1">
          Đang hoạt động
        </p>
        <p className="text-2xl font-bold text-emerald-700">{stats.active}</p>
        <p className="text-[11px] text-emerald-600 mt-1">Sẵn sàng xuất bến</p>
      </div>

      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
        <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-1">
          Bảo dưỡng
        </p>
        <p className="text-2xl font-bold text-amber-700">{stats.maintenance}</p>
        <p className="text-[11px] text-amber-600 mt-1">Đang kiểm tra kỹ thuật</p>
      </div>

      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
        <p className="text-xs font-semibold text-rose-600 uppercase tracking-wider mb-1">
          Ngừng hoạt động
        </p>
        <p className="text-2xl font-bold text-rose-700">{stats.inactive}</p>
        <p className="text-[11px] text-rose-600 mt-1">Tạm dừng vận hành</p>
      </div>
    </div>
  );
}
