export interface SeatSelection {
  seatNumber: string;
  clientId: string;
}

type SeatEventType = "SEAT_SELECTED" | "SEAT_DESELECTED";

export interface SeatInteractionRequest extends SeatSelection {
  tripId: number;
  type: SeatEventType;
}

export interface SeatInteractionEvent extends SeatInteractionRequest {
  timestamp: string;
}

export interface SeatSnapshotEvent {
  tripId: number;
  type: "SEAT_SNAPSHOT";
  selections: SeatSelection[];
  bookedSeats: string[];
  viewerCount: number;
  timestamp: string;
}

interface SeatsChangedEvent {
  tripId: number;
  type: "SEATS_CHANGED";
  timestamp: string;
}

interface TripViewersEvent {
  tripId: number;
  type: "VIEWERS_UPDATED";
  viewerCount: number;
  timestamp: string;
}

export type SeatRealtimeMessage = SeatInteractionEvent | SeatSnapshotEvent | TripViewersEvent | SeatsChangedEvent;

// Tương thích với API giữ ghế có sẵn, không dùng cho tương tác chọn ghế.
export interface SeatHoldEvent {
  type: "SEAT_HELD" | "SEAT_RELEASED";
  payload: SeatSelection;
}
