"use client";

import { FaBus, FaCircle } from "react-icons/fa";
import { FiEdit, FiEye, FiRefreshCw, FiTrash2 } from "react-icons/fi";
import { Bus } from "@/types";

interface BusTableProps {
  buses: Bus[];
  loading: boolean;
  onEdit: (bus: Bus) => void;
  onDelete: (bus: Bus) => void;
  onView: (bus: Bus) => void;
  onToggleStatus: (bus: Bus) => void;
}

export function BusTable({
  buses,
  loading,
  onEdit,
  onDelete,
  onView,
  onToggleStatus,
}: BusTableProps) {
  if (loading) {
    return (
      <div className="py-16 text-center text-gray-400">
        <div className="inline-block animate-spin text-2xl mb-2"><FiRefreshCw aria-hidden="true" className="inline-block shrink-0 align-middle" /></div>
        <p className="text-xs">Đang tải danh sách phương tiện...</p>
      </div>
    );
  }

  if (buses.length === 0) {
    return (
      <div className="py-16 text-center text-gray-500">
        <span className="text-4xl block mb-2"><FaBus aria-hidden="true" className="inline-block shrink-0 align-middle" /></span>
        <p className="text-sm font-semibold">Không tìm thấy xe nào</p>
        <p className="text-xs text-gray-400 mt-1">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs text-left">
        <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider font-semibold border-b border-gray-200">
          <tr>
            <th className="px-5 py-3.5">Mã Xe</th>
            <th className="px-5 py-3.5">Biển số</th>
            <th className="px-5 py-3.5">Loại xe & Hãng</th>
            <th className="px-5 py-3.5">Số chỗ</th>
            <th className="px-5 py-3.5">Tài xế phụ trách</th>
            <th className="px-5 py-3.5">Trạng thái</th>
            <th className="px-5 py-3.5 text-right">Thao tác</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {buses.map((bus) => {
            let statusClassName = "bg-rose-100 text-rose-800 hover:bg-rose-200";
            if (bus.status === "Đang hoạt động") {
              statusClassName = "bg-emerald-100 text-emerald-800 hover:bg-emerald-200";
            } else if (bus.status === "Bảo dưỡng") {
              statusClassName = "bg-amber-100 text-amber-800 hover:bg-amber-200";
            }
            let statusDotClassName = "text-rose-500";
            if (bus.status === "Đang hoạt động") {
              statusDotClassName = "text-emerald-500";
            } else if (bus.status === "Bảo dưỡng") {
              statusDotClassName = "text-amber-500";
            }

            return (
              <tr key={bus.id} className="hover:bg-gray-50/80 transition-colors">
                <td className="px-5 py-3.5 font-bold text-gray-900">{bus.id}</td>
                <td className="px-5 py-3.5">
                  <span className="font-extrabold text-sm text-gray-900 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                    {bus.plate}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <p className="font-semibold text-gray-900">{bus.type}</p>
                  <p className="text-[11px] text-gray-400">{bus.brand || "Chưa cập nhật"}</p>
                </td>
                <td className="px-5 py-3.5">
                  <span className="font-bold text-gray-800">{bus.capacity} chỗ</span>
                </td>
                <td className="px-5 py-3.5">
                  {bus.driverName ? (
                    <div>
                      <p className="font-semibold text-gray-900">{bus.driverName}</p>
                      <p className="text-[11px] text-gray-400">{bus.driverPhone || ""}</p>
                    </div>
                  ) : (
                    <span className="text-gray-400 italic">Chưa phân công</span>
                  )}
                </td>
                <td className="px-5 py-3.5">
                  <button
                    onClick={() => onToggleStatus(bus)}
                    title="Nhấp để đổi trạng thái"
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer transition-transform active:scale-95 ${statusClassName}`}
                  >
                    <FaCircle
                      aria-hidden="true"
                      className={`w-1.5 h-1.5 shrink-0 ${statusDotClassName}`}
                    />
                    <span>{bus.status}</span>
                  </button>
                </td>
                <td className="px-5 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      aria-label="Xem chi tiết"
                      onClick={() => onView(bus)}
                      className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                      title="Xem chi tiết"
                    >
                      <FiEye aria-hidden="true" className="inline-block shrink-0 align-middle" />
                    </button>
                    <button
                      aria-label="Chỉnh sửa"
                      onClick={() => onEdit(bus)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="Chỉnh sửa"
                    >
                      <FiEdit aria-hidden="true" className="inline-block shrink-0 align-middle" />
                    </button>
                    <button
                      aria-label="Xóa xe"
                      onClick={() => onDelete(bus)}
                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded transition-colors"
                      title="Xóa xe"
                    >
                      <FiTrash2 aria-hidden="true" className="inline-block shrink-0 align-middle" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
