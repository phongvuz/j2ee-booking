"use client";

import { FaBus } from "react-icons/fa";
import { FiX } from "react-icons/fi";
import { Bus } from "@/types";

interface BusDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  bus: Bus | null;
  onEdit: (bus: Bus) => void;
}

export function BusDetailModal({
  isOpen,
  onClose,
  bus,
  onEdit,
}: BusDetailModalProps) {
  if (!isOpen || !bus) return null;

  let statusClassName = "bg-rose-500/20 text-rose-300";
  if (bus.status === "Đang hoạt động") {
    statusClassName = "bg-emerald-500/20 text-emerald-300";
  } else if (bus.status === "Bảo dưỡng") {
    statusClassName = "bg-amber-500/20 text-amber-300";
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white relative">
          <button
            aria-label="Đóng"
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded"
          >
            <FiX aria-hidden="true" className="inline-block shrink-0 align-middle" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-brand-primary text-white flex items-center justify-center text-2xl font-bold shadow-sm">
              <FaBus aria-hidden="true" className="inline-block shrink-0 align-middle" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {bus.id}
              </span>
              <h2 className="text-xl font-extrabold tracking-tight">{bus.plate}</h2>
              <span
                className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${statusClassName}`}
              >
                {bus.status}
              </span>
            </div>
          </div>
        </div>

        {/* Content details */}
        <div className="p-6 space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3 pb-3 border-b border-gray-100">
            <div>
              <span className="text-gray-400 block text-[11px]">Loại xe</span>
              <span className="font-bold text-gray-900">{bus.type}</span>
            </div>
            <div>
              <span className="text-gray-400 block text-[11px]">Sức chứa</span>
              <span className="font-bold text-gray-900">{bus.capacity} chỗ ngồi/phòng</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pb-3 border-b border-gray-100">
            <div>
              <span className="text-gray-400 block text-[11px]">Hãng sản xuất</span>
              <span className="font-medium text-gray-800">{bus.brand || "—"}</span>
            </div>
            <div>
              <span className="text-gray-400 block text-[11px]">Năm sản xuất</span>
              <span className="font-medium text-gray-800">{bus.year || "—"}</span>
            </div>
          </div>

          <div className="pb-3 border-b border-gray-100">
            <span className="text-gray-400 block text-[11px]">Tài xế quản lý</span>
            <p className="font-semibold text-gray-900 mt-0.5">
              {bus.driverName || "Chưa phân công tài xế cố định"}
            </p>
            {bus.driverPhone && (
              <p className="text-gray-500 text-[11px]">SĐT: {bus.driverPhone}</p>
            )}
          </div>

          <div className="pb-3 border-b border-gray-100">
            <span className="text-gray-400 block text-[11px]">Bảo dưỡng gần nhất</span>
            <p className="font-medium text-gray-800 mt-0.5">
              {bus.lastMaintenance || "Chưa có thông tin lịch sử"}
            </p>
          </div>

          {bus.notes && (
            <div>
              <span className="text-gray-400 block text-[11px]">Ghi chú tình trạng</span>
              <p className="text-gray-700 bg-gray-50 p-2.5 rounded-lg mt-1 italic">
                {bus.notes}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
          >
            Đóng
          </button>
          <button
            onClick={() => {
              onClose();
              onEdit(bus);
            }}
            className="px-4 py-2 bg-brand-primary hover:bg-brand-dark text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            Chỉnh sửa thông tin
          </button>
        </div>
      </div>
    </div>
  );
}
