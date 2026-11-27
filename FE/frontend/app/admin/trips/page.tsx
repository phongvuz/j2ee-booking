"use client";

import { TableSort } from "@/components/admin/TableSort";
import { tripSortOptions } from "@/lib/admin-table-sort";

import { FiAlertTriangle, FiPlus } from "react-icons/fi";
import { useEffect, useState } from "react";
import { useToast } from "@/components/admin/Toast";
import { useTrips } from "@/hooks/useTrips";
import { TripTable } from "@/components/admin/trips/TripTable";
import { TripFilters } from "@/components/admin/trips/TripFilters";
import { TripStats } from "@/components/admin/trips/TripStats";
import { TripModal } from "@/components/admin/trips/TripModal";
import { TripDetailModal } from "@/components/admin/trips/TripDetailModal";
import { DeleteTripModal } from "@/components/admin/trips/DeleteTripModal";
import { EmployeePagination } from "@/components/admin/employees/EmployeePagination";
import { TripAdminItem } from "@/types/trip";
import { TripFormValues } from "@/lib/validations/trip";
import { mergeTripLocations } from "@/lib/trip-locations";
import { requestJson } from "@/lib/api-client";

export default function AdminTripsPage() {
  const {
    trips,
    stats,
    pagination,
    loading,
    error,
    filters,
    setSearch,
    setFrom,
    setTo,
    setDate,
    setPage,
    setLimit,
    resetFilters,
    sort,
    setSort,
    refresh,
    createTrip,
    updateTrip,
    deleteTrip,
  } = useTrips();

  const { success, error: toastError } = useToast();
  const [locations, setLocations] = useState<string[]>(() => mergeTripLocations());
  useEffect(() => {
    const controller = new AbortController();
    void requestJson<{ data: string[] }>("/api/trips/locations", { signal: controller.signal })
      .then(({ data }) => {
        if (Array.isArray(data) && data.every((value) => typeof value === "string")) {
          setLocations(mergeTripLocations(data));
        }
      })
      .catch(() => { /* Defaults and the trip's current route remain selectable. */ });
    return () => controller.abort();
  }, []);

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selectedTrip, setSelectedTrip] = useState<TripAdminItem | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  function handleOpenCreate() {
    setSelectedTrip(null);
    setFormMode("create");
    setIsFormModalOpen(true);
  }

  function handleOpenEdit(trip: TripAdminItem) {
    setSelectedTrip(trip);
    setFormMode("edit");
    setIsFormModalOpen(true);
  }

  function handleOpenDelete(trip: TripAdminItem) {
    setSelectedTrip(trip);
    setIsDeleteModalOpen(true);
  }

  function handleOpenDetail(trip: TripAdminItem) {
    setSelectedTrip(trip);
    setIsDetailModalOpen(true);
  }

  async function handleFormSubmit(data: TripFormValues) {
    if (formMode === "create") {
      const response = await createTrip(data);
      if (response.success) {
        success(response.message || "Tạo chuyến xe mới thành công!", "Thêm chuyến");
        return { success: true };
      }

      toastError(response.message || "Không thể tạo chuyến xe", "Lỗi tạo mới");
      return { success: false, message: response.message };
    } else if (selectedTrip) {
      const response = await updateTrip(selectedTrip.id, data);
      if (response.success) {
        success(response.message || "Cập nhật chuyến xe thành công!", "Cập nhật");
        return { success: true };
      }

      toastError(response.message || "Không thể cập nhật chuyến xe", "Lỗi");
      return { success: false, message: response.message };
    }
    return { success: false };
  }

  async function handleConfirmDelete(id: number) {
    const response = await deleteTrip(id);
    if (response.success) {
      success(response.message || "Đã xóa chuyến xe thành công!", "Đã xóa");
      return { success: true };
    }

    toastError(response.message || "Không thể xóa chuyến xe", "Lỗi xóa");
    return { success: false, message: response.message };
  }

  return (
    <div className="pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <span>Quản lý Tuyến & Chuyến xe</span>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleOpenCreate}
            className="bg-brand-primary hover:bg-brand-dark text-white px-4 py-2.5 rounded-lg font-bold text-xs transition-all shadow-xs flex items-center gap-2 cursor-pointer active:scale-98"
          >
            <span className="text-base font-bold">
              <FiPlus
                aria-hidden="true"
                className="inline-block shrink-0 align-middle"
              />
            </span>
            <span>Thêm chuyến xe mới</span>
          </button>
        </div>
      </div>

      <TripStats stats={stats} />

      {/* Error Banner */}
      {error && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>
              <FiAlertTriangle
                aria-hidden="true"
                className="inline-block shrink-0 align-middle"
              />
            </span>
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
        <TripFilters
          locations={locations}
          search={filters.search}
          onSearchChange={setSearch}
          from={filters.from}
          onFromChange={setFrom}
          to={filters.to}
          onToChange={setTo}
          date={filters.date}
          onDateChange={setDate}
          onReset={resetFilters}
        />

        {/* Table */}
        <TableSort value={sort} options={tripSortOptions} onChange={setSort} />

        <TripTable
          trips={trips}
          loading={loading}
          onEdit={handleOpenEdit}
          onDelete={handleOpenDelete}
          onView={handleOpenDetail}
        />

        {/* Pagination */}
        <EmployeePagination
          pagination={pagination}
          onPageChange={setPage}
          onLimitChange={setLimit}
        />
      </div>

      {/* Chỉ tạo form khi mở để dữ liệu và lỗi được làm mới mỗi lần. */}
      {isFormModalOpen && (
        <TripModal
          locations={locations}
          key={selectedTrip?.id ?? "create"}
          isOpen={isFormModalOpen}
          onClose={() => setIsFormModalOpen(false)}
          onSubmit={handleFormSubmit}
          initialData={selectedTrip}
          mode={formMode}
        />
      )}

      <TripDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        trip={selectedTrip}
        onEdit={(trip) => handleOpenEdit(trip)}
      />

      {isDeleteModalOpen && (
        <DeleteTripModal
          key={selectedTrip?.id}
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          trip={selectedTrip}
          onConfirmDelete={handleConfirmDelete}
        />
      )}
    </div>
  );
}
