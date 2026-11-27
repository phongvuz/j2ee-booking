import { getSeatCodes } from "@/lib/seats";
import type { SeatSelection } from "@/types/seat-realtime";

export interface TripSeatState {
  capacity: number;
  bookedSeats: string[];
  holds: { seatNumber: string; isOwn: boolean }[];
  selections: SeatSelection[];
}

// Reconcile local choices against both durable reservations and current viewers.
export function availableSeatSelection(selectedSeats: string[], state: TripSeatState, clientId: string) {
  const validSeats = new Set(getSeatCodes(state.capacity));
  const unavailable = new Set([
    ...state.bookedSeats,
    ...state.holds.filter((hold) => !hold.isOwn).map((hold) => hold.seatNumber),
    ...state.selections.filter((selection) => selection.clientId !== clientId).map((selection) => selection.seatNumber),
  ]);
  return selectedSeats.filter((seat) => validSeats.has(seat) && !unavailable.has(seat));
}
