"use client";

import { TableSort } from "@/components/admin/TableSort";
import { busSortOptions } from "@/lib/admin-table-sort";

import { FiAlertTriangle, FiPlus, FiRefreshCw } from "react-icons/fi";
import { useState } from "react";
import { useToast } from "@/components/admin/Toast";
import { useBuses } from "@/hooks/useBuses";
import { BusTable } from "@/components/admin/buses/BusTable";
import { BusFilters } from "@/components/admin/buses/BusFilters";
import { BusStats } from "@/components/admin/buses/BusStats";
import { BusModal } from "@/components/admin/buses/BusModal";
import { BusDetailModal } from "@/components/admin/buses/BusDetailModal";
import { DeleteBusModal } from "@/components/admin/buses/DeleteBusModal";
import { EmployeePagination } from "@/components/admin/employees/EmployeePagination";
import { Bus } from "@/types";
import { BusFormValues } from "@/lib/validations/bus";

export default function AdminBusesPage() {
  const {
    buses,
    stats,
    pagination,
    loading,
    error,
    filters,
    setSearch,
    setType,
    setStatus,
    setPage,
    setLimit,
    resetFilters,
    sort,
    setSort,
    refresh,
    createBus,
    updateBus,
    deleteBus,
    changeStatus,
  } = useBuses();

  const { success, error: toastError, info } = useToast();

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selectedBus, setSelectedBus] = useState<Bus | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  function handleOpenCreate() {
    setSelectedBus(null);
    setFormMode("create");
    setIsFormModalOpen(true);
  }

  function handleOpenEdit(bus: Bus) {
    setSelectedBus(bus);
    setFormMode("edit");
    setIsFormModalOpen(true);
  }

  function handleOpenDelete(bus: Bus) {
    setSelectedBus(bus);
    setIsDeleteModalOpen(true);
  }

  function handleOpenDetail(bus: Bus) {
    setSelectedBus(bus);
    setIsDetailModalOpen(true);
  }

  async function handleFormSubmit(data: BusFormValues) {
    if (formMode === "create") {
      const response = await createBus(data);
      if (response.success) {
        success(response.message || "Đã thêm phương tiện thành công!", "Thêm mới xe");
        return { success: true };
      }

      toastError(response.message || "Không thể thêm xe", "Lỗi tạo mới");
      return { success: false, message: response.message };
    } else if (selectedBus) {
      const response = await updateBus(selectedBus.id, data);
      if (response.success) {
        success(response.message || "Cập nhật phương tiện thành công!", "Cập nhật");
        return { success: true };
      }

      toastError(response.message || "Không thể cập nhật xe", "Lỗi cập nhật");
      return { success: false, message: response.message };
    }
    return { success: false };
  }

  async function handleConfirmDelete(id: string) {
    const response = await deleteBus(id);
    if (response.success) {
      success(response.message || "Đã xóa xe thành công!", "Đã xóa");
      return { success: true };
    }

    toastError(response.message || "Không thể xóa xe", "Lỗi xóa");
    return { success: false, message: response.message };
  }

  return (
    <div className="pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <span>Quản lý Đội xe</span>
            <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2.5 py-0.5 rounded-full">
              {pagination.total} xe
            </span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Quản lý số hiệu xe, biển kiểm soát, loại giường phòng và lịch trình bảo dưỡng
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
            onClick={handleOpenCreate}
            className="bg-brand-primary hover:bg-brand-dark text-white px-4 py-2.5 rounded-lg font-bold text-xs transition-all shadow-xs flex items-center gap-2 cursor-pointer active:scale-98"
          >
            <span className="text-base font-bold"><FiPlus aria-hidden="true" className="inline-block shrink-0 align-middle" /></span>
            <span>Thêm xe mới</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <BusStats stats={stats} total={pagination.total} />

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
        <BusFilters
          search={filters.search}
          onSearchChange={setSearch}
          type={filters.type}
          onTypeChange={setType}
          status={filters.status}
          onStatusChange={setStatus}
          onReset={resetFilters}
        />

        {/* Table */}
        <TableSort value={sort} options={busSortOptions} onChange={setSort} />

        <BusTable
          buses={buses}
          loading={loading}
          onEdit={handleOpenEdit}
          onDelete={handleOpenDelete}
          onView={handleOpenDetail}
          onToggleStatus={(bus) => {
            const nextStatus =
              bus.status === "Đang hoạt động"
                ? "Bảo dưỡng"
                : bus.status === "Bảo dưỡng"
                  ? "Ngừng hoạt động"
                  : "Đang hoạt động";
            changeStatus(bus.id, nextStatus);
            info(`Đã đổi trạng thái xe ${bus.plate} sang ${nextStatus}`);
          }}
        />

        {/* Pagination */}
        <EmployeePagination
          pagination={pagination}
          onPageChange={setPage}
          onLimitChange={setLimit}
        />
      </div>

      {/* Modals */}
      <BusModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSubmit={handleFormSubmit}
        initialData={selectedBus}
        mode={formMode}
      />

      <BusDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        bus={selectedBus}
        onEdit={(bus) => handleOpenEdit(bus)}
      />

      <DeleteBusModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        bus={selectedBus}
        onConfirmDelete={handleConfirmDelete}
      />
    </div>
  );
}
