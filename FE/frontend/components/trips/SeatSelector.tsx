"use client";
import SeatMap from "./SeatMap";
import BookingForm from "./BookingForm";
import { useState } from "react";
import { useRouter } from "next/navigation";
import generateSeats from "./seatUtils";
import { getErrorMessage, requestJson } from "@/lib/api-client";
import { useSeatRealtime } from "@/hooks/useSeatRealtime";
import type { BookingResult } from "@/types";

interface SeatSelectorProps {
  tripId: number;
  pricePerSeat: number;
  capacity: number;
  bookedSeats?: string[];
}

export default function SeatSelector({
  tripId,
  pricePerSeat, capacity,
  bookedSeats = [],
}: SeatSelectorProps) {
  const router = useRouter();

  const {
    selectedSeats, remoteSeats, isConnected, isSending,
    connectionError, viewerCount, sendError, toggleSeat: sendSeatInteraction, reconnect,
    bookedSeats: liveBookedSeats, heldSeatNumbers, capacity: liveCapacity, getClientId,
  } = useSeatRealtime(tripId, capacity, bookedSeats);
  const seats = generateSeats(liveBookedSeats, liveCapacity);
  const remoteSeatNumbers = [...new Set([...heldSeatNumbers, ...remoteSeats.map((selection) => selection.seatNumber)])];
  const [passengerName, setPassengerName] = useState("");
  const [passengerPhone, setPassengerPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const toggleSeat = (seatNumber: string, isBooked: boolean) => {
    if (isBooked || isSubmitting || isSending) return;
    if (remoteSeatNumbers.includes(seatNumber) && !selectedSeats.includes(seatNumber)) return;
    setErrorMessage("");
    void sendSeatInteraction(seatNumber);
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!isConnected || isSending) {
      setErrorMessage("Vui lòng chờ kết nối Realtime và thao tác chọn ghế hoàn tất.");
      return;
    }
    if (selectedSeats.length === 0) {
      setErrorMessage("Vui lòng chọn ít nhất 1 ghế!");
      return;
    }
    if (!passengerName.trim() || !passengerPhone.trim()) {
      setErrorMessage("Vui lòng nhập đầy đủ họ tên và số điện thoại hành khách!");
      return;
    }

    try {
      setIsSubmitting(true);
      const data = await requestJson<{ success: boolean; data: BookingResult }>("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId,
          clientId: getClientId(),
          seats: selectedSeats,
          fullName: passengerName.trim(),
          phone: passengerPhone.trim(),
        }),
      });

      // Đặt vé thành công -> Chuyển đến trang xác nhận vé thật
      router.push(`/success?pnr=${encodeURIComponent(data.data.pnr)}`);
    } catch (err) {
      setErrorMessage(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalPrice = selectedSeats.length * pricePerSeat;

  return (
    <div className="flex flex-col md:flex-row gap-8">
      <div className="w-full md:w-7/12" data-realtime-connected={isConnected}>
        {isConnected && viewerCount !== null && (
          <p className="mb-3 text-sm text-gray-600" role="status" aria-live="polite" data-viewer-count={viewerCount}>
            {viewerCount} người đang xem chuyến xe
          </p>
        )}
        {connectionError && (
          <div className="mb-3 flex flex-wrap items-center gap-3" role="alert">
            <span className="text-sm text-amber-700">{connectionError}</span>
            {!isConnected && (
              <button type="button" onClick={reconnect} disabled={isSending} className="text-sm text-blue-700 underline">
                Kết nối lại
              </button>
            )}
          </div>
        )}
        {sendError && <p role="alert" className="mb-3 text-sm text-red-700">{sendError}</p>}
        <SeatMap
          seats={seats}
          selectedSeats={selectedSeats}
          remoteSeatNumbers={remoteSeatNumbers}
          isRealtimeEnabled
          isSubmitting={isSubmitting || isSending || !isConnected}
          onToggleSeat={toggleSeat}
        />
      </div>
      <div className="w-full md:w-5/12">
        <BookingForm
          tripId={tripId} selectedSeats={selectedSeats}
          pricePerSeat={pricePerSeat} totalPrice={totalPrice}
          passengerName={passengerName} passengerPhone={passengerPhone}
          isSubmitting={isSubmitting || isSending} errorMessage={errorMessage}
          onNameChange={setPassengerName} onPhoneChange={setPassengerPhone} onSubmit={handleCheckout}
        />
      </div>
    </div>
  );
}
