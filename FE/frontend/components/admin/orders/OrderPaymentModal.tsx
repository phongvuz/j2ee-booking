"use client";

import { useEffect, useRef, useState } from "react";
import type { MoneyMethod, OrderItem } from "@/types";
import { formatPrice } from "@/lib/trip-display";

interface OrderPaymentModalProps {
  order: OrderItem;
  kind: "RECEIPT" | "REFUND";
  onClose: () => void;
  onSubmit: (method: MoneyMethod) => Promise<{ success: boolean; message?: string }>;
}

export function OrderPaymentModal({ order, kind, onClose, onSubmit }: OrderPaymentModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [method, setMethod] = useState<MoneyMethod>("CASH");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const label = kind === "RECEIPT" ? "thu tiền" : "hoàn tiền";
  const isDemo = order.transactions.some((entry) => entry.method === "DEMO");
  const amount = kind === "RECEIPT" ? order.amountDue : order.refundDue;

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const response = await onSubmit(method);
      if (response.success) onClose();
      else setError(response.message ?? "Không thể lưu giao dịch.");
    } catch {
      setError("Không thể lưu giao dịch. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="money-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      className="fixed inset-0 m-auto w-[calc(100%_-_2rem)] max-w-md max-h-[90dvh] overflow-y-auto rounded-xl bg-white p-6 backdrop:bg-black/50"
    >
      <form onSubmit={submit} className="space-y-4">
        <h2 id="money-title" className="text-lg font-bold">Ghi nhận {label}</h2>
        <p className="text-sm">{order.pnr} · Ghế {order.seatNumber}</p>
        <p className="text-xl font-bold">{formatPrice(amount)}</p>
        <p className="text-sm text-amber-800">Chỉ xác nhận sau khi đã thực sự {kind === "RECEIPT" ? "nhận tiền từ" : "hoàn tiền cho"} khách. Thao tác này ghi sổ, không tự chuyển tiền ngân hàng.</p>
        {isDemo ? (
          <p className="text-sm text-amber-800">Vé demo: chỉ ghi nhận hoàn tiền giả lập, không hoàn tiền thật.</p>
        ) : (
          <label className="block text-sm">
            Phương thức
            <select
              autoFocus
              disabled={busy}
              value={method}
              onChange={(event) => setMethod(event.target.value as MoneyMethod)}
              className="mt-2 w-full rounded border p-2"
            >
              <option value="CASH">Tiền mặt</option>
              <option value="BANK_TRANSFER">Chuyển khoản</option>
            </select>
          </label>
        )}
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" disabled={busy} onClick={onClose} className="rounded border px-3 py-2">
            Đóng
          </button>
          <button type="submit" disabled={busy} className="rounded bg-brand-primary px-3 py-2 text-white disabled:opacity-50">
            {busy ? "Đang lưu..." : `Xác nhận ${label}`}
          </button>
        </div>
      </form>
    </dialog>
  );
}
