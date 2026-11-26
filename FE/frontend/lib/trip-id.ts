import { z } from "zod";
import { BusinessError } from "@/lib/business-error";

export const tripIdSchema = z.number().int().positive().max(2147483647);

export function assertTripId(tripId: number): number {
  const result = tripIdSchema.safeParse(tripId);
  if (!result.success) throw new BusinessError("ID chuyến xe phải là số nguyên dương hợp lệ.");
  return result.data;
}

export function parseTripId(value: string): number {
  if (!/^\d+$/.test(value)) throw new BusinessError("ID chuyến xe phải là số nguyên dương hợp lệ.");
  return assertTripId(Number(value));
}
