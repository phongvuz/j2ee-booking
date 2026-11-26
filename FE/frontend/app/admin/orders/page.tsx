"use client";

import { TableSort } from "@/components/admin/TableSort";
import { orderSortOptions } from "@/lib/admin-table-sort";

import { FiAlertTriangle, FiPlus, FiRefreshCw } from "react-icons/fi";
import { Suspense, useState } from "react";
import { useToast } from "@/components/admin/Toast";
import { useOrders } from "@/hooks/useOrders";
import { OrderTable } from "@/components/admin/orders/OrderTable";
import { OrderFilters } from "@/components/admin/orders/OrderFilters";
import { OrderStats } from "@/components/admin/orders/OrderStats";
import { OrderDetailModal } from "@/components/admin/orders/OrderDetailModal";
import { CreateOfflineOrderModal } from "@/components/admin/orders/CreateOfflineOrderModal";
import { CancelOrderModal } from "@/components/admin/orders/CancelOrderModal";
import { OrderPaymentModal } from "@/components/admin/orders/OrderPaymentModal";
import { EmployeePagination } from "@/components/admin/employees/EmployeePagination";
import { OrderItem, BookingStatus } from "@/types";
import { OfflineOrderFormValues } from "@/lib/validations/order";

export default function AdminOrdersPage() {
  return <Suspense fallback={<p>Đang tải bộ lọc đơn hàng...</p>}><AdminOrdersContent /></Suspense>;
}

function AdminOrdersContent() {
  const {
    orders,
    stats,
    pagination,
    loading,
    error,
    filters,
    setSearch,
    setStatus,
    setDate,
    setPage,
    setLimit,
    resetFilters,
    sort,
    setSort,
    refresh,
    createOfflineOrder,
    changeStatus,
    deleteOrder,
    recordPayment,
    actionLoading,
  } = useOrders();

  const { success, error: toastError, info } = useToast();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [moneyAction, setMoneyAction] = useState<{ order: OrderItem; kind: "RECEIPT" | "REFUND" } | null>(null);

  function handleOpenDetail(order: OrderItem) {
    setSelectedOrder(order);
    setIsDetailModalOpen(true);
  }

  function handleOpenCancel(order: OrderItem) {
    setSelectedOrder(order);
    setIsCancelModalOpen(true);
  }

  async function handleCreateOffline(data: OfflineOrderFormValues) {
    const response = await createOfflineOrder(data);
    if (response.success) {
      success(response.message || "Tạo vé thành công!", "Xuất vé quầy");
      return { success: true };
    }

    toastError(response.message || "Không thể tạo vé", "Lỗi");
    return { success: false, message: response.message };
  }

  async function handleUpdateStatus(order: OrderItem, newStatus: BookingStatus) {
    const response = await changeStatus(order.id, newStatus);
    if (response.success) {
      success(response.message || "Cập nhật trạng thái thành công!", "Thành công");
    } else {
      toastError(response.message || "Không thể cập nhật trạng thái", "Lỗi");
    }
  }

  async function handleConfirmCancel(id: number) {
    const response = await deleteOrder(id);
    if (response.success) {
      info(response.message || "Đã hủy đơn vé và hoàn trả ghế trống!", "Đã hủy vé");
      return { success: true };
    }

    toastError(response.message || "Không thể hủy vé", "Lỗi");
    return { success: false, message: response.message };
  }

  return (
    <div className="pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <span>Quản lý Đơn hàng & Vé</span>
            <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2.5 py-0.5 rounded-full">
              {pagination.total} lượt đặt
            </span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Tra cứu mã PNR, xuất vé offline tại quầy, cập nhật thanh toán và xử lý hoàn hủy vé
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refresh()}
            disabled={loading}
            className="p-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg shadow-2xs transition-colors text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Làm mới dữ liệu"
          >
            <span className={loading ? "animate-spin" : ""}><FiRefreshCw aria-hidden="true" className="inline-block shrink-0 align-middle" /></span>
            <span className="hidden sm:inline">Làm mới</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-brand-primary hover:bg-brand-dark text-white px-4 py-2.5 rounded-lg font-bold text-xs transition-all shadow-xs flex items-center gap-2 cursor-pointer active:scale-98"
          >
            <span className="text-base font-bold"><FiPlus aria-hidden="true" className="inline-block shrink-0 align-middle" /></span>
            <span>Tạo vé tại quầy (Offline)</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <OrderStats stats={stats} />

      {/* Error Banner */}
      {error && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span><FiAlertTriangle aria-hidden="true" className="inline-block shrink-0 align-middle" /></span>
            <span>{error}</span>
          </div>
          <button
            onClick={() => refresh()}
            className="font-bold underline hover:no-underline"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Main Table Card */}
      <div className="bg-white rounded-xl shadow-2xs border border-gray-200 overflow-hidden">
        {/* Filters */}
        <OrderFilters
          search={filters.search}
          onSearchChange={setSearch}
          status={filters.status}
          onStatusChange={setStatus}
          date={filters.date}
          onDateChange={setDate}
          onReset={resetFilters}
        />

        {/* Table */}
        <TableSort value={sort} options={orderSortOptions} onChange={setSort} />

        <OrderTable
          orders={orders}
          loading={loading}
          onView={handleOpenDetail}
          onUpdateStatus={handleUpdateStatus}
          onCancel={handleOpenCancel}
          busy={actionLoading}
          onPayment={(order, kind) => setMoneyAction({ order, kind })}
        />

        {/* Pagination */}
        <EmployeePagination
          pagination={pagination}
          onPageChange={setPage}
          onLimitChange={setLimit}
        />
      </div>

      {/* Modals */}
      <CreateOfflineOrderModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateOffline}
      />

      <OrderDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        order={selectedOrder}
      />

      <CancelOrderModal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        order={selectedOrder}
        onConfirmCancel={handleConfirmCancel}
      />
      {moneyAction && <OrderPaymentModal
        key={`${moneyAction.order.id}-${moneyAction.kind}`}
        order={moneyAction.order}
        kind={moneyAction.kind}
        onClose={() => setMoneyAction(null)}
        onSubmit={async (method) => {
          const response = await recordPayment(moneyAction.order.id, moneyAction.kind, method);
          if (response.success) success(response.message ?? "Đã lưu giao dịch.");
          else toastError(response.message ?? "Không thể lưu giao dịch.");
          return response;
        }}
      />}
    </div>
  );
}
