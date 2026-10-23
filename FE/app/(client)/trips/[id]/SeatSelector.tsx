"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Seat {
  id: string;
  isBooked: boolean;
}

interface SeatSelectorProps {
  tripId: string;
  pricePerSeatStr: string; // e.g. "300.000đ"
}

export default function SeatSelector({ tripId, pricePerSeatStr }: SeatSelectorProps) {
  const router = useRouter();
  
  // Extract numeric price
  const priceNumeric = parseInt(pricePerSeatStr.replace(/\D/g, ''));

  // Generate some dummy seats for a sleeper bus (2 floors, 3 rows)
  const [seats] = useState<Seat[]>(() => {
    const generated = [];
    const rows = ['A', 'B', 'C'];
    for (let floor = 1; floor <= 2; floor++) {
      for (const row of rows) {
        for (let num = 1; num <= 6; num++) {
          generated.push({
            id: `${floor}${row}${num}`,
            isBooked: Math.random() > 0.7, // 30% booked
          });
        }
      }
    }
    return generated;
  });

  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [passengerName, setPassengerName] = useState("");
  const [passengerPhone, setPassengerPhone] = useState("");

  const toggleSeat = (seatId: string, isBooked: boolean) => {
    if (isBooked) return;
    
    setSelectedSeats(prev => {
      if (prev.includes(seatId)) {
        return prev.filter(id => id !== seatId);
      } else {
        if (prev.length >= 5) {
          alert("Bạn chỉ được chọn tối đa 5 ghế");
          return prev;
        }
        return [...prev, seatId];
      }
    });
  };

  const handleCheckout = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSeats.length === 0) {
      alert("Vui lòng chọn ít nhất 1 ghế!");
      return;
    }
    if (!passengerName || !passengerPhone) {
      alert("Vui lòng nhập đầy đủ thông tin hành khách!");
      return;
    }
    
    // In a real app, save to state management or API here
    router.push(`/success?tripId=${tripId}&seats=${selectedSeats.join(",")}`);
  };

  const totalPrice = selectedSeats.length * priceNumeric;

  const renderFloor = (floorNum: number) => {
    const floorSeats = seats.filter(s => s.id.startsWith(floorNum.toString()));
    return (
      <div className="bg-white p-4 border border-gray-200 rounded-lg">
        <h4 className="text-center font-bold text-gray-700 mb-4 pb-2 border-b">
          Tầng {floorNum === 1 ? "Dưới" : "Trên"}
        </h4>
        <div className="grid grid-cols-3 gap-x-4 gap-y-3">
          {['A', 'B', 'C'].map((row) => (
            <div key={row} className="flex flex-col gap-3">
              {floorSeats.filter(s => s.id.charAt(1) === row).map(seat => (
                <button
                  key={seat.id}
                  type="button"
                  onClick={() => toggleSeat(seat.id, seat.isBooked)}
                  disabled={seat.isBooked}
                  className={`w-full py-3 rounded text-sm font-bold border transition-colors ${
                    seat.isBooked 
                      ? "bg-gray-300 text-gray-500 border-gray-400 cursor-not-allowed opacity-50" 
                      : selectedSeats.includes(seat.id)
                        ? "bg-[#ef5222] text-white border-[#ef5222]"
                        : "bg-white text-gray-700 border-gray-300 hover:border-[#ef5222] hover:text-[#ef5222]"
                  }`}
                >
                  {seat.id.substring(1)}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col md:flex-row gap-8">
      {/* Left: Seat Map */}
      <div className="w-full md:w-7/12">
        <div className="bg-gray-50 p-6 border border-gray-200 rounded-lg shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-gray-800">Chọn ghế của bạn</h3>
            <div className="flex gap-4 text-sm font-medium">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-white border border-gray-300 rounded"></div>
                <span>Trống</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-[#ef5222] border border-[#ef5222] rounded"></div>
                <span>Đang chọn</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-gray-300 border border-gray-400 rounded opacity-50"></div>
                <span>Đã đặt</span>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            {renderFloor(1)}
            {renderFloor(2)}
          </div>
        </div>
      </div>

      {/* Right: Checkout Summary */}
      <div className="w-full md:w-5/12">
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 sticky top-24">
          <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Thông tin thanh toán</h3>
          
          <div className="mb-6">
            <div className="flex justify-between mb-2">
              <span className="text-gray-600">Ghế đã chọn:</span>
              <span className="font-bold">{selectedSeats.length > 0 ? selectedSeats.join(", ") : "Chưa chọn"}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-gray-600">Tạm tính:</span>
              <span className="font-bold">{totalPrice.toLocaleString('vi-VN')} đ</span>
            </div>
            <div className="flex justify-between mt-4 pt-4 border-t border-gray-100">
              <span className="text-gray-800 font-bold text-lg">Tổng tiền:</span>
              <span className="font-extrabold text-2xl text-[#ef5222]">{totalPrice.toLocaleString('vi-VN')} đ</span>
            </div>
          </div>

          <form onSubmit={handleCheckout}>
            <h4 className="font-bold text-gray-800 mb-3 text-sm">Thông tin hành khách</h4>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Họ và tên *</label>
                <input 
                  type="text" 
                  required
                  value={passengerName}
                  onChange={e => setPassengerName(e.target.value)}
                  className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:border-[#ef5222]" 
                  placeholder="Nhập họ tên" 
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Số điện thoại *</label>
                <input 
                  type="tel" 
                  required
                  value={passengerPhone}
                  onChange={e => setPassengerPhone(e.target.value)}
                  className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:border-[#ef5222]" 
                  placeholder="Nhập số điện thoại" 
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={selectedSeats.length === 0}
              className={`w-full font-bold py-3 px-4 rounded-md transition-colors ${
                selectedSeats.length > 0 
                  ? "bg-[#ef5222] hover:bg-[#d94a1d] text-white" 
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
            >
              Thanh toán ngay
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
