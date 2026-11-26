import { BusinessError } from "@/lib/business-error";

// VND amounts are stored as integer dong throughout trips, tickets and payments.
export function assertTripPrice(value: number): number {
  if (!Number.isSafeInteger(value) || value < 10000 || value > 10000000) {
    throw new BusinessError("Giá vé phải là số nguyên từ 10.000 đến 10.000.000 đồng.");
  }
  return value;
}
