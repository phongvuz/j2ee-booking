"use client";

import { useCallback, useState } from "react";
import type { UserQueryParams, UserListResponse } from "@/types";
import type { UserFormValues } from "@/lib/validations/user";
import * as userService from "@/services/clientUserService";
import { useDebouncedSearch } from "./useDebouncedSearch";
import { useRemoteData } from "./useRemoteData";
import { useAsyncAction } from "./useAsyncAction";
import { useTableSort } from "./useTableSort";
import { userSortOptions } from "@/lib/admin-table-sort";

// Dữ liệu hiển thị trước khi API trả kết quả.
const INITIAL_DATA: UserListResponse = {
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
    users: 0,
    admins: 0,
    newThisMonth: 0,
  },
};

export function useUsers(initialParams?: UserQueryParams) {
  const [page, setPage] = useState(initialParams?.page ?? 1);
  const [limit, setLimit] = useState(initialParams?.limit ?? 10);
  const [role, setRole] = useState(initialParams?.role ?? "");
  const resetPage = useCallback(function resetPage() {
    setPage(1);
  }, []);
  const { sort, setSort } = useTableSort({
    sortBy: initialParams?.sortBy ?? "createdAt",
    sortOrder: initialParams?.sortOrder ?? "desc",
  }, resetPage, userSortOptions);
  const { search, appliedSearch, changeSearch, resetSearch } = useDebouncedSearch(initialParams?.search ?? "", resetPage);
  const { actionLoading, runAction } = useAsyncAction();

  // useCallback giữ hàm tải ổn định; chỉ tải lại khi bộ lọc thay đổi.
  const loadUsers = useCallback(
    function loadUsers(signal: AbortSignal) {
      return userService.fetchAdminUsers(
        {
          search: appliedSearch,
          role,
          page,
          limit,
          sortBy: sort.sortBy,
          sortOrder: sort.sortOrder,
        },
        signal,
      );
    },
    [appliedSearch, role, page, limit, sort],
  );
  const { data, loading, error, refresh } = useRemoteData(loadUsers, INITIAL_DATA);

  function resetFilters() {
    resetSearch();
    setRole("");
    setPage(1);
  }

  function filterRole(value: string) {
    setRole(value);
    setPage(1);
  }

  function createUser(payload: UserFormValues) {
    return runAction(async () => {
      const response = await userService.createUser(payload);
      resetFilters();
      refresh();
      return response.message || "Tạo người dùng thành công!";
    });
  }

  function updateUser(id: number | string, payload: Partial<UserFormValues>) {
    return runAction(async () => {
      const response = await userService.updateUser(id, payload);
      refresh();
      return response.message || "Cập nhật người dùng thành công!";
    });
  }

  function deleteUser(id: number | string) {
    return runAction(async () => {
      const response = await userService.deleteUser(id);
      refresh();
      return response.message || "Xóa người dùng thành công!";
    });
  }

  function changeRole(id: number | string, role: "USER" | "ADMIN") {
    return runAction(async () => {
      const response = await userService.changeUserRole(id, role);
      refresh();
      return response.message || "Cập nhật quyền thành công!";
    });
  }

  return {
    users: data.data,
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
      page,
      limit,
    },
    setSearch: changeSearch,
    setRole: filterRole,
    setPage,
    setLimit,
    resetFilters,
    refresh,
    createUser,
    updateUser,
    deleteUser,
    changeRole,
  };
}
