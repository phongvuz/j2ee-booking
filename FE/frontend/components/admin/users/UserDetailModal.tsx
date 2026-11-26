"use client";

import { FiArrowRight, FiUser, FiX } from "react-icons/fi";
import { FaCrown } from "react-icons/fa";
import { useCallback } from "react";
import type { UserAccount, UserDetailResponse } from "@/types";
import { fetchUserById } from "@/services/clientUserService";
import { useRemoteData } from "@/hooks/useRemoteData";
import { formatPrice } from "@/lib/trip-display";

interface UserDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserAccount | null;
  onEdit: (user: UserAccount) => void;
}

export function UserDetailModal(props: UserDetailModalProps) {
  if (!props.isOpen || !props.user) return null;
  return <UserDetailContent key={props.user.id} {...props} user={props.user} />;
}

type UserDetails = NonNullable<UserDetailResponse["data"]>;

function UserDetailContent({ onClose, user, onEdit }: UserDetailModalProps & { user: UserAccount }) {
  const load = useCallback(async function loadUserDetails(signal: AbortSignal) {
    const response = await fetchUserById(user.id, signal);
    if (!response.data) {
      throw new Error("Không thể tải thông tin tài khoản.");
    }
    return response.data;
  }, [user.id]);
  const { data: detailedData, loading, error, refresh } = useRemoteData<UserDetails | null>(load, null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
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
            <div className="w-12 h-12 rounded-full bg-brand-primary text-white flex items-center justify-center text-xl font-bold shadow-sm">
              {user.fullName.charAt(0).toUpperCase()}
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Tài khoản #{user.id}
              </span>
              <h2 className="text-xl font-extrabold tracking-tight">{user.fullName}</h2>
              <span
                className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${user.role === "ADMIN"
                    ? "bg-purple-500/20 text-purple-300"
                    : "bg-emerald-500/20 text-emerald-300"
                  }`}
              >
                {user.role === "ADMIN" ? <FaCrown aria-hidden="true" className="inline-block shrink-0 align-middle" /> : <FiUser aria-hidden="true" className="inline-block shrink-0 align-middle" />}{" "}
                {user.role === "ADMIN" ? "QUẢN TRỊ VIÊN" : user.isGuest ? "KHÁCH VÃNG LAI" : "KHÁCH HÀNG"}
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
          {/* Contact and stats summary */}
          <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3.5 rounded-xl border border-gray-200">
            <div>
              <span className="text-gray-400 block text-[11px]">Số điện thoại</span>
              <span className="font-bold text-gray-900 text-sm">{user.phone || "—"}</span>
            </div>
            <div>
              <span className="text-gray-400 block text-[11px]">Ngày đăng ký</span>
              <span className="font-medium text-gray-800">
                {new Date(user.createdAt).toLocaleDateString("vi-VN")}
              </span>
            </div>
            <div>
              <span className="text-gray-400 block text-[11px]">Tổng vé đã đặt</span>
              <span className="font-bold text-gray-900">
                {user._count?.booking || 0} vé
              </span>
            </div>
            <div>
              <span className="text-gray-400 block text-[11px]">Tổng tiền tích lũy</span>
              <span className="font-black text-brand-primary">
                {formatPrice(user.totalSpent || 0)}
              </span>
            </div>
          </div>

          {/* Bookings History */}
          <div>
            <span className="font-bold text-gray-900 text-xs uppercase tracking-wider block mb-2">
              Lịch sử vé đã đặt ({detailedData?.bookings?.length || 0})
            </span>

            {error ? (
              <div role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">
                <p>{error}</p>
                <button type="button" onClick={refresh} className="mt-2 underline">Thử lại</button>
              </div>
            ) : loading ? (
              <div className="text-center py-6 text-gray-400">Đang tải lịch sử vé...</div>
            ) : !detailedData?.bookings || detailedData.bookings.length === 0 ? (
              <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-gray-400">
                Khách hàng chưa có lịch sử đặt vé nào
              </div>
            ) : (
              <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                {detailedData.bookings.map((b) => (
                  <div key={b.id} className="p-3 flex items-center justify-between bg-white hover:bg-gray-50">
                    <div>
                      <p className="font-bold text-gray-900">
                        {b.trip?.from} <FiArrowRight aria-hidden="true" className="inline-block shrink-0 align-middle" /> {b.trip?.to}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        Ghế: <strong className="text-emerald-700">{b.seatNumber}</strong> • Ngày đặt: {new Date(b.createdAt).toLocaleDateString("vi-VN")}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-gray-900 block text-xs">
                        {formatPrice(b.totalPrice)}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${b.status === "CONFIRMED"
                            ? "bg-emerald-100 text-emerald-700"
                            : b.status === "PENDING"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-rose-100 text-rose-700"
                          }`}
                      >
                        {b.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
            disabled={user.isGuest}
            onClick={() => {
              onClose();
              onEdit(user);
            }}
            className="px-4 py-2 bg-brand-primary hover:bg-brand-dark text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Chỉnh sửa tài khoản
          </button>
        </div>
      </div>
    </div>
  );
}
