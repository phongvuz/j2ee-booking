import { prisma } from "@/lib/prisma";
import { runTransaction } from "@/lib/transaction";
import { broadcastSeatRefresh } from "@/lib/sse";

export async function expirePendingBookings() {
  const now = new Date();

  const candidates = await prisma.booking.findMany({
    where: {
      status: "PENDING",
      expiresAt: { lte: now },
    },
    select: { id: true, tripId: true },
    orderBy: [{ expiresAt: "asc" }, { id: "asc" }],
    take: 100,
  });

  let expiredCount = 0;

  for (const booking of candidates) {
    const changed = await runTransaction(async (tx) => {
      const result = await tx.booking.updateMany({
        where: {
          id: booking.id,
          tripId: booking.tripId,
          status: "PENDING",
          expiresAt: { lte: now },
        },
        data: {
          status: "CANCELLED",
          activeSeat: null,
        },
      });

      if (result.count === 0) return false;

      await tx.trip.update({
        where: { id: booking.tripId },
        data: {
          availableSeats: { increment: result.count },
        },
      });

      return true;
    });

    if (changed) {
      expiredCount += 1;
      broadcastSeatRefresh(booking.tripId);
    }
  }

  return expiredCount;
}