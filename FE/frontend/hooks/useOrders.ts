"use client";

import { useCallback } from "react";
import { useSearchParams } from "next/navigation";
import type { OrderListResponse, BookingStatus, MoneyMethod } from "@/types";
import type { OfflineOrderFormValues } from "@/lib/validations/order";
import * as orderService from "@/services/clientOrderService";
import { useRemoteData } from "./useRemoteData";
import { useAsyncAction } from "./useAsyncAction";
import { positiveInteger, readOption } from "@/lib/query-params";
import type { TableSortValue } from "@/types/table-sort";

const INITIAL_DATA: OrderListResponse = {
  success: true, data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
  stats: { total: 0, confirmed: 0, pending: 0, cancelled: 0, totalRevenue: 0, orderCount: 0, transactionCount: 0, received: 0, refunded: 0, refundDue: 0, amountDue: 0 },
};

export function useOrders() {
  const params = useSearchParams();
  const search = params.get("search") ?? "";
  const status = readOption(params.get("status"), ["", "CONFIRMED", "PENDING", "CANCELLED"] as const, "");
  const date = params.get("date") ?? "";
  const page = positiveInteger(params.get("page"), 1);
  const limit = positiveInteger(params.get("limit"), 10, 100);
  const sortBy = readOption(params.get("sortBy"), ["id", "createdAt", "totalPrice"] as const, "createdAt");
  const sortOrder = readOption(params.get("sortOrder"), ["asc", "desc"] as const, "desc");
  const { actionLoading, runAction } = useAsyncAction();
  const loadOrders = useCallback((signal: AbortSignal) => orderService.fetchAdminOrders({ search, status, date, page, limit, sortBy, sortOrder }, signal), [search, status, date, page, limit, sortBy, sortOrder]);
  const { data, loading, error, refresh } = useRemoteData(loadOrders, INITIAL_DATA);

  function updateFilters(values: Record<string, string | number>, replace = false) {
    const next = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(values)) {
      if (value === "") next.delete(key);
      else next.set(key, String(value));
    }
    const url = `${window.location.pathname}?${next.toString()}`;
    if (replace) window.history.replaceState(null, "", url);
    else window.history.pushState(null, "", url);
  }

  function resetFilters() {
    updateFilters({ search: "", status: "", date: "", page: 1 });
  }

  function createOfflineOrder(payload: OfflineOrderFormValues) {
    return runAction(async () => {
      const response = await orderService.createOfflineOrder(payload);
      refresh();
      return response.message || "Tạo vé tại quầy thành công!";
    });
  }

  function changeStatus(id: number | string, status: BookingStatus) {
    return runAction(async () => {
      const response = await orderService.updateOrderStatus(id, status);
      refresh();
      return response.message || "Cập nhật trạng thái vé thành công!";
    });
  }

  function recordPayment(id: number, kind: "RECEIPT" | "REFUND", method: MoneyMethod) {
    return runAction(async () => {
      const response = await orderService.recordOrderPayment(id, kind, method);
      refresh();
      return response.message || "Đã ghi nhận thu/hoàn tiền.";
    });
  }

  function deleteOrder(id: number | string) {
    return runAction(async () => {
      const response = await orderService.deleteOrder(id);
      refresh();
      return response.message || "Đã hủy vé, khoản đã thu được giữ lại để đối soát.";
    });
  }

  return {
    orders: data.data, stats: data.stats, pagination: data.pagination, loading, error, actionLoading,
    filters: { search, status, date, page, limit }, sort: { sortBy, sortOrder },
    setSearch: (value: string) => updateFilters({ search: value, page: 1 }, true),
    setStatus: (value: string) => updateFilters({ status: value, page: 1 }),
    setDate: (value: string) => updateFilters({ date: value, page: 1 }),
    setPage: (value: number) => updateFilters({ page: value }),
    setLimit: (value: number) => updateFilters({ limit: value, page: 1 }),
    setSort: (value: TableSortValue) => updateFilters({ ...value, page: 1 }),
    resetFilters, refresh, createOfflineOrder, changeStatus, recordPayment, deleteOrder,
  };
}
