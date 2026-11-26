import type { UserQueryParams, UserListResponse, UserDetailResponse, MutationResponse } from "@/types";
import type { UserFormValues } from "@/lib/validations/user";
import { buildQuery, requestJson } from "@/lib/api-client";

export function fetchAdminUsers(params: UserQueryParams = {}, signal?: AbortSignal) {
  return requestJson<UserListResponse>(`/api/users?${buildQuery(params)}`, { signal });
}

export function fetchUserById(id: number | string, signal?: AbortSignal) {
  return requestJson<UserDetailResponse>(`/api/users/${encodeURIComponent(id)}`, { signal });
}

export function createUser(payload: UserFormValues) {
  return requestJson<UserDetailResponse>("/api/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateUser(id: number | string, payload: Partial<UserFormValues>) {
  return requestJson<UserDetailResponse>(`/api/users/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteUser(id: number | string) {
  return requestJson<MutationResponse>(`/api/users/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function changeUserRole(id: number | string, role: "USER" | "ADMIN") {
  return requestJson<UserDetailResponse>(`/api/users/${encodeURIComponent(id)}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}
