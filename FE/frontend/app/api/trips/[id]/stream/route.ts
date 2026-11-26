import { NextRequest } from "next/server";
import { addClient, broadcastViewerCount, encodeRealtimeMessage, getSeatSnapshot, removeClient } from "@/lib/sse";
import { parseTripId } from "@/lib/trip-id";
import { apiError } from "@/lib/admin-api";
import { BusinessError } from "@/lib/business-error";
import { realtimeClientIdSchema } from "@/lib/validations/seat-realtime";
import { prisma } from "@/lib/prisma";
import { deriveSeatOwner, ensureSeatSession } from "@/lib/seat-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const tripId = parseTripId(id);
    const rawClientId = new URL(request.url).searchParams.get("clientId");
    const parsedClientId = realtimeClientIdSchema.safeParse(rawClientId);
    if (rawClientId !== null && !parsedClientId.success) {
      throw new BusinessError("Mã client không hợp lệ.");
    }
    const clientId = parsedClientId.success ? parsedClientId.data : undefined;
    const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { id: true, booking: { where: { status: { not: "CANCELLED" } }, select: { seatNumber: true } } } });
    if (!trip) throw new BusinessError("Không tìm thấy chuyến xe.", 404);
    const session = ensureSeatSession(request);
    const ownerKey = clientId ? deriveSeatOwner(session.id, clientId) : undefined;

    let cleanup = () => {};
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let isClosed = false;
        let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
        cleanup = () => {
          if (isClosed) return;
          isClosed = true;
          clearInterval(heartbeatTimer);
          request.signal.removeEventListener("abort", cleanup);
          removeClient(tripId, controller);
          try {
            controller.close();
          } catch {
            // Stream đã bị hủy hoặc đã đóng trước đó.
          }
        };

        addClient(tripId, controller, { clientId, ownerKey, cleanup });
        request.signal.addEventListener("abort", cleanup, { once: true });
        if (request.signal.aborted) {
          cleanup();
          return;
        }

        try {
          // Gửi ngay để EventSource mở kết nối và nhận trạng thái ban đầu.
          controller.enqueue(encodeRealtimeMessage(getSeatSnapshot(tripId, trip.booking.map((booking) => booking.seatNumber))));
          broadcastViewerCount(tripId);
          const encoder = new TextEncoder();
          heartbeatTimer = setInterval(() => {
            try {
              controller.enqueue(encoder.encode(": heartbeat\n\n"));
            } catch {
              cleanup();
            }
          }, 15000);
        } catch {
          cleanup();
        }
      },
      cancel() {
        cleanup();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-store, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
        ...(session.cookie ? { "Set-Cookie": session.cookie } : {}),
      },
    });
  } catch (error) {
    return apiError(error, "Không thể mở kết nối Realtime.");
  }
}
