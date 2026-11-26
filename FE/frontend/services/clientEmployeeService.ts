import type { EmployeeQueryParams, EmployeeListResponse, EmployeeDetailResponse, MutationResponse } from "@/types";
import type { EmployeeFormValues } from "@/lib/validations/employee";
import { buildQuery, requestJson } from "@/lib/api-client";

export function fetchEmployees(params: EmployeeQueryParams = {}, signal?: AbortSignal) {
  return requestJson<EmployeeListResponse>(`/api/employees?${buildQuery(params)}`, { signal });
}

export function createEmployee(payload: EmployeeFormValues) {
  return requestJson<EmployeeDetailResponse>("/api/employees", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateEmployee(id: string, payload: EmployeeFormValues) {
  return requestJson<EmployeeDetailResponse>(`/api/employees/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteEmployee(id: string) {
  return requestJson<MutationResponse>(`/api/employees/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function changeEmployeeStatus(id: string, status: string) {
  return requestJson<EmployeeDetailResponse>(`/api/employees/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}
