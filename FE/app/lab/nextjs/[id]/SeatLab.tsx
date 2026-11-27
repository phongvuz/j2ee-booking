"use client";

import { useSeatRealtime } from "@/hooks/useSeatRealtime";
import { getSeatCodes } from "@/lib/seats";

type SeatLabProps = {
  tripId: number;
  capacity: number;
  pricePerSeat: number;
  initialBookedSeats: string[];
};

type Live = {
  selectedSeats: string[];
  remoteSeats: { seatNumber: string }[];
  bookedSeats: string[];
  heldSeatNumbers: string[];
  isConnected: boolean;
  isSending: boolean;
};

// TODO 2: trạng thái của một nút ghế, theo đúng điều kiện trong đề.
export function seatButton(live: Live, seatNumber: string) {
  const booked = live.bookedSeats.includes(seatNumber);
  const selected = live.selectedSeats.includes(seatNumber);
  const remote = !selected && (
    live.remoteSeats.some((item) => item.seatNumber === seatNumber) ||
    live.heldSeatNumbers.includes(seatNumber)
  );
  const disabled = !live.isConnected || live.isSending || booked || remote;

  return { booked, selected, remote, disabled };
}

export default function SeatLab({
  tripId,
  capacity,
  pricePerSeat,
  initialBookedSeats,
}: SeatLabProps) {
  const live = useSeatRealtime(tripId, capacity, initialBookedSeats);

  return (
    <section
      aria-labelledby="seat-lab-title"
      className="space-y-4 rounded-lg border border-gray-200 bg-white p-6"
    >
      <h2 id="seat-lab-title" className="text-xl font-semibold">
        Sơ đồ ghế chuyến #{tripId}
      </h2>
      <p>Giá mỗi ghế: {pricePerSeat.toLocaleString("vi-VN")}đ</p>
      <p role="status">
        {live.isConnected ? "Đã kết nối" : "Chưa kết nối"}
      </p>
      {live.connectionError && (
        <p role="alert">{live.connectionError}</p>
      )}
      {live.sendError && (
        <p role="alert">{live.sendError}</p>
      )}
      <p>
        Ghế đã chọn: {live.selectedSeats.join(", ") || "Chưa chọn"}
      </p>
      <p>
        Tổng tiền:{" "}
        {(live.selectedSeats.length * pricePerSeat).toLocaleString("vi-VN")}đ
      </p>
      <div className="grid grid-cols-3 gap-3">
        {getSeatCodes(live.capacity).map((seat) => {
          const { booked, selected, remote, disabled } = seatButton(live, seat);

          return (
            <button
              key={seat}
              type="button"
              aria-label={`Ghế ${seat}`}
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => void live.toggleSeat(seat)}
              className={`rounded border p-3 ${
                booked || remote
                  ? "cursor-not-allowed border-gray-300 bg-gray-200 text-gray-500"
                  : selected
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-gray-300 bg-white text-gray-700"
              }`}
            >
              {seat}
            </button>
          );
        })}
      </div>
    </section>
  );
}
