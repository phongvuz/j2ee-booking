import { positiveInteger } from "@/lib/query-params";
import { getDepartureDayRange } from "@/lib/trip-search";
import type { TripSearchParams } from "@/types/trip";

export const tripTimeSlots = {
  early: { start: 0, end: 6 },
  morning: { start: 6, end: 12 },
  afternoon: { start: 12, end: 18 },
  night: { start: 18, end: 24 },
} as const;

export type TripTimeSlot = keyof typeof tripTimeSlots;
export type TripVehicleFilter = "limousine" | "sleeper" | "other";
export interface PublicTripFilters {
  from: string;
  to: string;
  date: string;
  times: TripTimeSlot[];
  vehicles: TripVehicleFilter[];
  page: number;
}

function first(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function selections<T extends string>(value: string | string[] | undefined, allowed: readonly T[]): T[] {
  const values = (Array.isArray(value) ? value : [value ?? ""]).flatMap((item) => item.split(","));
  return allowed.filter((item) => values.includes(item));
}

export function parsePublicTripFilters(params: TripSearchParams): PublicTripFilters {
  const date = first(params.date);
  return {
    from: first(params.from),
    to: first(params.to),
    date: getDepartureDayRange(date) ? date : "",
    times: selections(params.times, Object.keys(tripTimeSlots) as TripTimeSlot[]),
    vehicles: selections(params.vehicles, ["limousine", "sleeper", "other"] as const),
    page: positiveInteger(first(params.page), 1),
  };
}

export function publicTripUrl(filters: PublicTripFilters, page = filters.page): string {
  const query = new URLSearchParams();
  if (filters.from) query.set("from", filters.from);
  if (filters.to) query.set("to", filters.to);
  if (filters.date) query.set("date", filters.date);
  if (filters.times.length) query.set("times", filters.times.join(","));
  if (filters.vehicles.length) query.set("vehicles", filters.vehicles.join(","));
  if (page > 1) query.set("page", String(page));
  const search = query.toString();
  return search ? `/trips?${search}` : "/trips";
}

export function tripVehicleLabel(capacity: number, busType?: string): string {
  if (busType?.trim()) return busType.trim();
  if (capacity === 22) return "Limousine 22 phòng";
  if (capacity === 34) return "Giường nằm 34 chỗ";
  return `Xe ${capacity} chỗ`;
}
