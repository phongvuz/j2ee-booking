import type { Seat } from "@/types/trip";
import { getSeatCodes, normalizeSeat } from "@/lib/seats";

export default function generateSeats(bookedSeats: string[] = [], capacity = 36): Seat[] {
  const booked = new Set(bookedSeats.map(normalizeSeat));
  const numbersPerRow = Math.ceil(capacity / 3);
  return getSeatCodes(capacity).map((id) => ({
    id, row: id[0], num: Number(id.slice(1)),
    floor: Number(id.slice(1)) <= Math.ceil(numbersPerRow / 2) ? 1 : 2,
    isBooked: booked.has(id),
  }));
}
