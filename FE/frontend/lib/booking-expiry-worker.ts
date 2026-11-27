import { setTimeout } from "node:timers";
import { expirePendingBookings } from "@/services/bookingExpiryService";

const workerState = globalThis as typeof globalThis & {
  bookingExpiryWorkerStarted?: boolean;
};

export function startBookingExpiryWorker() {
  if (workerState.bookingExpiryWorkerStarted) return;

  workerState.bookingExpiryWorkerStarted = true;

  async function tick() {
    try {
      const count = await expirePendingBookings();

      if (count > 0) {
        console.info(
          `[booking-expiry] Đã hủy ${count} vé quá hạn.`,
        );
      }
    } catch (error) {
      console.error(
        "[booking-expiry] Không xử lý được vé quá hạn:",
        error,
      );
    } finally {
      setTimeout(() => {
        void tick();
      }, 15_000).unref();
    }
  }

  console.info(
    "[booking-expiry] Đã bật, kiểm tra định kỳ khoảng 15 giây.",
  );

  setTimeout(() => {
    void tick();
  }, 1_000).unref();
}