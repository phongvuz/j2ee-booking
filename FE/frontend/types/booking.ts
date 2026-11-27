import type { BookingStatus } from "./order";

export interface CreateBookingInput {
  tripId: number;
  seats: string[];
  fullName: string;
  phone: string;
  status?: BookingStatus;
  holdOwnerKey?: string;
  ownerId?: number;
  isOnline?: boolean;
  actorId?: number;
  paymentMethod?: import("./order").MoneyMethod;
}

export interface BookingResult {
  pnr: string;
  tripId: number;
  passenger: {
    name: string;
    phone: string;
  };
  seats: string[];
  totalPrice: number;
  bookingIds: number[];
}

