"use client";

import { FaBus, FaUmbrellaBeach } from "react-icons/fa";
import { FiUsers } from "react-icons/fi";
import type { EmployeeStats as EmployeeStatsData } from "@/types";

interface EmployeeStatsProps {
  stats: EmployeeStatsData;
}

export function EmployeeStats({ stats }: EmployeeStatsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 font-medium uppercase">Tổng nhân sự</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-orange-100 text-brand-primary flex items-center justify-center font-bold text-lg">
          <FiUsers aria-hidden="true" className="inline-block shrink-0 align-middle" />
        </div>
      </div>

      

      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 font-medium uppercase">Nghỉ phép</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{stats.onLeave}</p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center font-bold text-lg">
          <FaUmbrellaBeach aria-hidden="true" className="inline-block shrink-0 align-middle" />
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 font-medium uppercase">Đội xe (Tài & Phụ)</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{stats.drivers}</p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center font-bold text-lg">
          <FaBus aria-hidden="true" className="inline-block shrink-0 align-middle" />
        </div>
      </div>
    </div>
  );
}
