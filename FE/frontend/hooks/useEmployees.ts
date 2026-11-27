"use client";

import { useCallback, useState } from "react";
import type { EmployeeQueryParams, EmployeeListResponse } from "@/types";
import type { EmployeeFormValues } from "@/lib/validations/employee";
import * as employeeService from "@/services/clientEmployeeService";
import { useDebouncedSearch } from "./useDebouncedSearch";
import { useRemoteData } from "./useRemoteData";
import { useAsyncAction } from "./useAsyncAction";
import { useTableSort } from "./useTableSort";
import { employeeSortOptions } from "@/lib/admin-table-sort";

// Dữ liệu hiển thị trước khi API trả kết quả.
const INITIAL_DATA: EmployeeListResponse = {
  success: true,
  data: [],
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  },
  stats: {
    total: 0,
    active: 0,
    onLeave: 0,
    drivers: 0,
  },
};

export function useEmployees(initialParams?: EmployeeQueryParams) {
  const [page, setPage] = useState(initialParams?.page ?? 1);
  const [limit, setLimit] = useState(initialParams?.limit ?? 10);
  const [role, setRole] = useState(initialParams?.role ?? "");
  const [department, setDepartment] = useState(initialParams?.department ?? "");
  const [status, setStatus] = useState(initialParams?.status ?? "");
  const resetPage = useCallback(function resetPage() {
    setPage(1);
  }, []);
  const { sort, setSort } = useTableSort({
    sortBy: initialParams?.sortBy ?? "createdAt",
    sortOrder: initialParams?.sortOrder ?? "desc",
  }, resetPage, employeeSortOptions);
  const { search, appliedSearch, changeSearch, resetSearch } = useDebouncedSearch(initialParams?.search ?? "", resetPage);
  const { actionLoading, runAction } = useAsyncAction();

  // useCallback giữ hàm tải ổn định; chỉ tải lại khi bộ lọc thay đổi.
  const loadEmployees = useCallback(
    function loadEmployees(signal: AbortSignal) {
      return employeeService.fetchEmployees(
        {
          search: appliedSearch,
          role,
          department,
          status,
          page,
          limit,
          sortBy: sort.sortBy,
          sortOrder: sort.sortOrder,
        },
        signal,
      );
    },
    [appliedSearch, role, department, status, page, limit, sort],
  );
  const { data, loading, error, refresh } = useRemoteData(loadEmployees, INITIAL_DATA);

  function resetFilters() {
    resetSearch();
    setRole("");
    setDepartment("");
    setStatus("");
    setPage(1);
  }

  function filterRole(value: string) {
    setRole(value);
    setPage(1);
  }

  function filterDepartment(value: string) {
    setDepartment(value);
    setPage(1);
  }

  function filterStatus(value: string) {
    setStatus(value);
    setPage(1);
  }

  function createEmployee(payload: EmployeeFormValues) {
    return runAction(async () => {
      const response = await employeeService.createEmployee(payload);
      resetFilters();
      refresh();
      return response.message || "Tạo nhân viên thành công!";
    });
  }

  function updateEmployee(id: string, payload: EmployeeFormValues) {
    return runAction(async () => {
      const response = await employeeService.updateEmployee(id, payload);
      refresh();
      return response.message || "Cập nhật nhân viên thành công!";
    });
  }

  function deleteEmployee(id: string) {
    return runAction(async () => {
      const response = await employeeService.deleteEmployee(id);
      refresh();
      return response.message || "Xóa nhân viên thành công!";
    });
  }

  function changeStatus(id: string, status: string) {
    return runAction(async () => {
      const response = await employeeService.changeEmployeeStatus(id, status);
      refresh();
      return response.message || "Cập nhật trạng thái thành công!";
    });
  }

  return {
    employees: data.data,
    stats: data.stats,
    pagination: data.pagination,
    loading,
    error,
    actionLoading,
    sort,
    setSort,
    filters: {
      search,
      role,
      department,
      status,
      page,
      limit,
    },
    setSearch: changeSearch,
    setRole: filterRole,
    setDepartment: filterDepartment,
    setStatus: filterStatus,
    setPage,
    setLimit,
    resetFilters,
    refresh,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    changeStatus,
  };
}
