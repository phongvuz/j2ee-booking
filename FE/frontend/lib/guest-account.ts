import { randomBytes } from "node:crypto";

// Guest bookings have no authority over an account that shares a passenger phone.
export function createGuestPhone() {
  return `guest:${randomBytes(16).toString("hex")}`;
}

export function isGuestPhone(phone: string) {
  return /^guest:[a-f0-9]{32}$/.test(phone);
}
