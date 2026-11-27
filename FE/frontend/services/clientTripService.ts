import type { TripQueryParams, TripListAdminResponse, MutationResponse } from "@/types";
import type { TripFormValues } from "@/lib/validations/trip";
import { buildQuery, requestJson } from "@/lib/api-client";

export function fetchAdminTrips(params: TripQueryParams = {}, signal?: AbortSignal) {
  return requestJson<TripListAdminResponse>(`/api/trips?${buildQuery({ admin: true, ...params })}`, { signal });
}

export function createTrip(payload: TripFormValues) {
  return requestJson<MutationResponse>("/api/trips", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateTrip(id: number, payload: Partial<TripFormValues>) {
  return requestJson<MutationResponse>(`/api/trips/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteTrip(id: number) {
  return requestJson<MutationResponse>(`/api/trips/${encodeURIComponent(id)}`, { method: "DELETE" });
}
