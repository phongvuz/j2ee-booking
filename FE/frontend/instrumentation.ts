export async function register() {
  if (
    process.env.NEXT_RUNTIME !== "nodejs" ||
    process.env.NEXT_PHASE === "phase-production-build"
  ) {
    return;
  }

  const { startBookingExpiryWorker } = await import(
    "@/lib/booking-expiry-worker"
  );

  startBookingExpiryWorker();
}
