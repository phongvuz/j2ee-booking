"use client";

import { TableSort } from "@/components/admin/TableSort";
import { employeeSortOptions } from "@/lib/admin-table-sort";

import { FiAlertTriangle, FiPlus, FiRefreshCw } from "react-icons/fi";
import { useState } from "react";
import { useToast } from "@/components/admin/Toast";
import { useEmployees } from "@/hooks/useEmployees";
import { EmployeeTable } from "@/components/admin/employees/EmployeeTable";
import { EmployeeFilters } from "@/components/admin/employees/EmployeeFilters";
import { EmployeePagination } from "@/components/admin/employees/EmployeePagination";
import { EmployeeModal } from "@/components/admin/employees/EmployeeModal";
import { DeleteConfirmModal } from "@/components/admin/employees/DeleteConfirmModal";
import { EmployeeDetailModal } from "@/components/admin/employees/EmployeeDetailModal";
import { EmployeeStats } from "@/components/admin/employees/EmployeeStats";
import { Employee } from "@/types";
import { EmployeeFormValues } from "@/lib/validations/employee";

function AdminEmployeesContent() {
  const {
    employees,
    stats,
    pagination,
    loading,
    error,
    filters,
    setSearch,
    setRole,
    setStatus,
    setPage,
    setLimit,
    resetFilters,
    sort,
    setSort,
    refresh,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    changeStatus,
  } = useEmployees();

  const { success, error: toastError, info } = useToast();

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Open Create Modal
  function handleOpenCreate() {
    setSelectedEmployee(null);
    setFormMode("create");
    setIsFormModalOpen(true);
  }

  // Open Edit Modal
  function handleOpenEdit(employee: Employee) {
    setSelectedEmployee(employee);
    setFormMode("edit");
    setIsFormModalOpen(true);
  }

  // Open Delete / Deactivate Modal
  function handleOpenDelete(employee: Employee) {
    setSelectedEmployee(employee);
    setIsDeleteModalOpen(true);
  }

  // Open Details Modal
  function handleOpenDetail(employee: Employee) {
    setSelectedEmployee(employee);
    setIsDetailModalOpen(true);
  }

  // Handle Form Submit (Create or Update)
  async function handleFormSubmit(data: EmployeeFormValues) {
    if (formMode === "create") {
      const response = await createEmployee(data);
      if (response.success) {
        success(response.message || "Đã thêm nhân viên thành công!", "Thêm mới");
        return { success: true };
      }

      toastError(response.message || "Không thể thêm nhân viên", "Lỗi tạo mới");
      return { success: false, message: response.message };
    } else if (selectedEmployee) {
      const response = await updateEmployee(selectedEmployee.id, data);
      if (response.success) {
        success(response.message || "Cập nhật nhân viên thành công!", "Cập nhật");
        return { success: true };
      }

      toastError(response.message || "Không thể cập nhật nhân viên", "Lỗi cập nhật");
      return { success: false, message: response.message };
    }
    return { success: false };
  }

  // Handle Confirm Permanent Delete
  async function handleConfirmDelete(id: string) {
    const response = await deleteEmployee(id);
    if (response.success) {
      success(response.message || "Đã xóa nhân viên thành công!", "Đã xóa");
      return { success: true };
    }

    toastError(response.message || "Không thể xóa nhân viên", "Lỗi xóa");
    return { success: false, message: response.message };
  }

  // Handle Confirm Deactivate
  async function handleConfirmDeactivate(id: string) {
    const response = await changeStatus(id, "Đã nghỉ việc");
    if (response.success) {
      info(response.message || "Đã chuyển trạng thái sang Đã nghỉ việc", "Đã cập nhật");
      return { success: true };
    }

    toastError(response.message || "Không thể cập nhật trạng thái", "Lỗi");
    return { success: false, message: response.message };
  }

  return (
    <div className="pb-12">
      {/* Top Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight flex items-center gap-2">
            <span>Quản lý Nhân sự</span>
            <span className="text-xs bg-orange-100 text-brand-primary font-semibold px-2.5 py-0.5 rounded-full">
              {pagination.total} nhân viên
            </span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Quản lý danh sách tài xế, phụ xe, nhân viên điều hành và văn phòng
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refresh()}
            disabled={loading}
            className="p-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg shadow-sm transition-colors text-sm font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Làm mới dữ liệu"
          >
            <span className={loading ? "animate-spin" : ""}><FiRefreshCw aria-hidden="true" className="inline-block shrink-0 align-middle" /></span>
            <span className="hidden sm:inline">Làm mới</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="bg-brand-primary hover:bg-brand-dark text-white px-4 py-2.5 rounded-lg font-semibold text-sm transition-all shadow-sm hover:shadow flex items-center gap-2 cursor-pointer active:scale-98"
          >
            <span className="text-base font-bold"><FiPlus aria-hidden="true" className="inline-block shrink-0 align-middle" /></span>
            <span>Thêm nhân viên mới</span>
          </button>
        </div>
      </div>

      {/* Stats Cards Overview */}
      <EmployeeStats stats={stats} />

      {/* Error Banner if any */}
      {error && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg"><FiAlertTriangle aria-hidden="true" className="inline-block shrink-0 align-middle" /></span>
            <span>{error}</span>
          </div>
          <button
            onClick={() => refresh()}
            className="text-xs font-semibold text-rose-800 underline hover:no-underline"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Main Table Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Filter Toolbar */}
        <EmployeeFilters
          search={filters.search}
          onSearchChange={setSearch}
          role={filters.role}
          onRoleChange={setRole}
          status={filters.status}
          onStatusChange={setStatus}
          onReset={resetFilters}
        />

        {/* Employees Table */}
        <TableSort value={sort} options={employeeSortOptions} onChange={setSort} />

        <EmployeeTable
          employees={employees}
          loading={loading}
          onEdit={handleOpenEdit}
          onDelete={handleOpenDelete}
          onView={handleOpenDetail}

        />

        {/* Pagination Toolbar */}
        <EmployeePagination
          pagination={pagination}
          onPageChange={setPage}
          onLimitChange={setLimit}
        />
      </div>

      {/* Modal: Create & Edit Employee */}
      <EmployeeModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSubmit={handleFormSubmit}
        initialData={selectedEmployee}
        mode={formMode}
      />

      {/* Modal: Confirm Delete / Deactivate */}
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        employee={selectedEmployee}
        onConfirmDelete={handleConfirmDelete}
        onConfirmDeactivate={handleConfirmDeactivate}
      />

      {/* Modal: Employee Profile Detail */}
      <EmployeeDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        employee={selectedEmployee}
        onEdit={(employee) => handleOpenEdit(employee)}
      />
    </div>
  );
}

export default function AdminEmployeesPage() {
  return <AdminEmployeesContent />;
}
