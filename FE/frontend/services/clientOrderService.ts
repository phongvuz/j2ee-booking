import type { OrderQueryParams, OrderListResponse, OrderDetailResponse, BookingStatus, MutationResponse, MoneyMethod } from "@/types";
import type { OfflineOrderFormValues } from "@/lib/validations/order";
import { buildQuery, requestJson } from "@/lib/api-client";

export function fetchAdminOrders(params: OrderQueryParams = {}, signal?: AbortSignal) {
  return requestJson<OrderListResponse>(`/api/admin/orders?${buildQuery(params)}`, { signal });
}

export function createOfflineOrder(payload: OfflineOrderFormValues) {
  return requestJson<OrderDetailResponse>("/api/admin/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteOrder(id: number | string) {
  return requestJson<MutationResponse>(`/api/admin/orders/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function updateOrderStatus(id: number | string, status: BookingStatus) {
  return requestJson<OrderDetailResponse>(`/api/admin/orders/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function recordOrderPayment(id: number, kind: "RECEIPT" | "REFUND", method: MoneyMethod) {
  return requestJson<MutationResponse>(`/api/admin/orders/${id}/payment`, { method: "POST", body: JSON.stringify({ kind, method }) });
}
