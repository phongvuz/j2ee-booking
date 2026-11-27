"use client";

import { FiAlertTriangle, FiRefreshCw } from "react-icons/fi";
import { useCallback } from "react";
import type { DashboardStats, DashboardResponse } from "@/types";
import { requestJson } from "@/lib/api-client";
import { useRemoteData } from "@/hooks/useRemoteData";
import { DashboardOverview } from "@/components/admin/dashboard/DashboardOverview";
import { RecentOrders } from "@/components/admin/dashboard/RecentOrders";
import { DashboardAlerts } from "@/components/admin/dashboard/DashboardAlerts";

export default function AdminDashboardPage() {
  const load = useCallback(async function loadDashboard(signal: AbortSignal) {
    const response = await requestJson<DashboardResponse>("/api/admin/stats", { signal });
    return response.data;
  }, []);
  const { data: stats, loading, error, refresh } = useRemoteData<DashboardStats | null>(load, null);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Bảng điều khiển hệ thống
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Tổng hợp dữ liệu doanh thu, vé bán, hoạt động phương tiện và nhân sự nhà xe
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={refresh}
            disabled={loading}
            className="p-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg shadow-2xs transition-colors text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <span className={loading ? "animate-spin" : ""}><FiRefreshCw aria-hidden="true" className="inline-block shrink-0 align-middle" /></span>
            <span>Làm mới dữ liệu</span>
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span><FiAlertTriangle aria-hidden="true" className="inline-block shrink-0 align-middle" /></span>
            <span>{error}</span>
          </div>
          <button
            onClick={refresh}
            className="text-xs font-semibold text-rose-800 underline"
          >
            Thử lại
          </button>
        </div>
      )}

      <DashboardOverview stats={stats} loading={loading} />

      {/* Main Content Grid: Recent Orders & System Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <RecentOrders stats={stats} loading={loading} />

        <DashboardAlerts stats={stats} />
      </div>
    </div>
  );
}
