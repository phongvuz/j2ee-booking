"use client";

import { useCallback, useState } from "react";
import type { TripQueryParams, TripListAdminResponse } from "@/types";
import type { TripFormValues } from "@/lib/validations/trip";
import * as tripService from "@/services/clientTripService";
import { tripSortOptions } from "@/lib/admin-table-sort";
import { useAsyncAction } from "./useAsyncAction";
import { useDebouncedSearch } from "./useDebouncedSearch";
import { useRemoteData } from "./useRemoteData";
import { useTableSort } from "./useTableSort";

// Dữ liệu mặc định để giao diện có thể hiển thị trước khi tải xong.
const INITIAL_TRIP_DATA: TripListAdminResponse = {
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
    departingToday: 0,
    totalBookings: 0,
    avgOccupancy: 0,
  },
};

export function useTrips(initialParams?: TripQueryParams) {
  const [page, setPage] = useState(initialParams?.page ?? 1);
  const [limit, setLimit] = useState(initialParams?.limit ?? 10);
  const [from, setFrom] = useState(initialParams?.from ?? "");
  const [to, setTo] = useState(initialParams?.to ?? "");
  const [date, setDate] = useState(initialParams?.date ?? "");

  const resetPage = useCallback(function resetPage() {
    setPage(1);
  }, []);

  const { sort, setSort } = useTableSort(
    {
      sortBy: initialParams?.sortBy ?? "createdAt",
      sortOrder: initialParams?.sortOrder ?? "desc",
    },
    resetPage,
    tripSortOptions,
  );

  const {
    search,
    appliedSearch,
    changeSearch,
    resetSearch,
  } = useDebouncedSearch(initialParams?.search ?? "", resetPage);

  const { actionLoading, runAction } = useAsyncAction();

  // Chỉ tạo lại hàm tải khi bộ lọc thay đổi, tránh tải liên tục mỗi lần render.
  const loadTrips = useCallback(
    function loadTrips(signal: AbortSignal) {
      return tripService.fetchAdminTrips(
        {
          search: appliedSearch,
          from,
          to,
          date,
          page,
          limit,
          sortBy: sort.sortBy,
          sortOrder: sort.sortOrder,
        },
        signal,
      );
    },
    [appliedSearch, from, to, date, page, limit, sort],
  );

  const { data, loading, error, refresh } = useRemoteData(
    loadTrips,
    INITIAL_TRIP_DATA,
  );

  function resetFilters() {
    resetSearch();
    setFrom("");
    setTo("");
    setDate("");
    setPage(1);
  }

  function filterFrom(value: string) {
    setFrom(value);
    setPage(1);
  }

  function filterTo(value: string) {
    setTo(value);
    setPage(1);
  }

  function filterDate(value: string) {
    setDate(value);
    setPage(1);
  }

  function createTrip(payload: TripFormValues) {
    return runAction(async () => {
      const response = await tripService.createTrip(payload);
      resetFilters();
      refresh();

      return response.message || "Tạo chuyến xe thành công!";
    });
  }

  function updateTrip(
    id: number,
    payload: Partial<TripFormValues>,
  ) {
    return runAction(async () => {
      const response = await tripService.updateTrip(id, payload);
      refresh();

      return response.message || "Cập nhật chuyến xe thành công!";
    });
  }

  function deleteTrip(id: number) {
    return runAction(async () => {
      const response = await tripService.deleteTrip(id);
      refresh();

      return response.message || "Xóa chuyến xe thành công!";
    });
  }

  return {
    trips: data.data,
    stats: data.stats,
    pagination: data.pagination,
    loading,
    error,
    actionLoading,
    sort,
    setSort,
    filters: {
      search,
      from,
      to,
      date,
      page,
      limit,
    },
    setSearch: changeSearch,
    setFrom: filterFrom,
    setTo: filterTo,
    setDate: filterDate,
    setPage,
    setLimit,
    resetFilters,
    refresh,
    createTrip,
    updateTrip,
    deleteTrip,
  };
}
