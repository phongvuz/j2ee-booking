import { BusinessError } from "@/lib/business-error";
import { seatHoldEventSchema, seatRealtimeMessageSchema } from "@/lib/validations/seat-realtime";
import type { SeatHoldEvent, SeatInteractionEvent, SeatRealtimeMessage, SeatSnapshotEvent } from "@/types/seat-realtime";

interface SeatConnection {
  clientId?: string;
  ownerKey?: string;
  cleanup: () => void;
}

interface TripRealtimeState {
  connections: Map<ReadableStreamDefaultController<Uint8Array>, SeatConnection>;
  selectedSeatsByClient: Map<string, Set<string>>;
}

interface SeatRealtimeStore {
  trips: Map<number, TripRealtimeState>;
}

// Một bộ quản lý trong CÙNG tiến trình Node.js, kể cả development và production.
// Không chia sẻ được với tiến trình khác hoặc máy chủ khác.
const globalForRealtime = globalThis as typeof globalThis & {
  seatRealtimeStore?: SeatRealtimeStore;
};
const realtimeStore = globalForRealtime.seatRealtimeStore ?? { trips: new Map() };
globalForRealtime.seatRealtimeStore = realtimeStore;
const encoder = new TextEncoder();

export function addClient(
  tripId: number,
  controller: ReadableStreamDefaultController<Uint8Array>,
  connection: SeatConnection,
) {
  let tripState = realtimeStore.trips.get(tripId);
  if (!tripState) {
    tripState = { connections: new Map(), selectedSeatsByClient: new Map() };
    realtimeStore.trips.set(tripId, tripState);
  }
  if (connection.clientId) {
    if (!connection.ownerKey) throw new BusinessError("Phiên chọn ghế không hợp lệ.", 403);
    const existingOwner = [...tripState.connections.values()].find((current) => current.clientId === connection.clientId)?.ownerKey;
    if (existingOwner && existingOwner !== connection.ownerKey) throw new BusinessError("Mã kết nối đang được sử dụng. Vui lòng kết nối lại.", 409);
  }
  tripState.connections.set(controller, connection);
}

export function getSeatSnapshot(tripId: number, bookedSeats: string[] = []): SeatSnapshotEvent {
  const selections: SeatSnapshotEvent["selections"] = [];
  const tripState = realtimeStore.trips.get(tripId);
  if (tripState) {
    for (const [clientId, selectedSeats] of tripState.selectedSeatsByClient) {
      for (const seatNumber of selectedSeats) {
        if (!bookedSeats.includes(seatNumber)) selections.push({ seatNumber, clientId });
      }
    }
  }
  return { type: "SEAT_SNAPSHOT", tripId, selections, bookedSeats, viewerCount: getViewerCount(tripId), timestamp: new Date().toISOString() };
}

export function broadcastSeatRefresh(tripId: number) {
  broadcast(tripId, { type: "SEATS_CHANGED", tripId, timestamp: new Date().toISOString() });
}

export function getViewerCount(tripId: number): number {
  const viewerIds = new Set<string>();
  const tripState = realtimeStore.trips.get(tripId);
  if (tripState) {
    for (const connection of tripState.connections.values()) {
      if (connection.clientId) viewerIds.add(connection.clientId);
    }
  }
  return viewerIds.size;
}

export function broadcastViewerCount(tripId: number) {
  broadcast(tripId, {
    type: "VIEWERS_UPDATED",
    tripId,
    viewerCount: getViewerCount(tripId),
    timestamp: new Date().toISOString(),
  });
}

export function encodeRealtimeMessage(message: SeatRealtimeMessage): Uint8Array {
  const validatedMessage = seatRealtimeMessageSchema.parse(message);
  return encoder.encode(`data: ${JSON.stringify(validatedMessage)}\n\n`);
}

export function broadcast(tripId: number, data: SeatRealtimeMessage | SeatHoldEvent) {
  const parsedMessage = seatRealtimeMessageSchema.safeParse(data);
  const parsedHold = seatHoldEventSchema.safeParse(data);
  if (!parsedMessage.success && !parsedHold.success) {
    throw new BusinessError("Sự kiện ghế không hợp lệ.");
  }
  if (parsedMessage.success && parsedMessage.data.tripId !== tripId) {
    throw new BusinessError("Sự kiện không thuộc chuyến xe này.");
  }
  const tripState = realtimeStore.trips.get(tripId);
  if (!tripState) return;

  const message = encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
  const failedConnections: SeatConnection[] = [];
  for (const [controller, connection] of [...tripState.connections]) {
    try {
      controller.enqueue(message);
    } catch {
      failedConnections.push(connection);
    }
  }
  // Dọn sau khi phát xong: cleanup có thể phát SEAT_DESELECTED.
  // Nhờ vậy client còn sống luôn nhận chọn trước, rồi mới nhận bỏ chọn.
  for (const connection of failedConnections) {
    connection.cleanup();
  }
}

export function removeClient(tripId: number, controller: ReadableStreamDefaultController<Uint8Array>) {
  const tripState = realtimeStore.trips.get(tripId);
  if (!tripState) return;
  const connection = tripState.connections.get(controller);
  if (!connection) return;
  tripState.connections.delete(controller);
  const clientId = connection?.clientId;
  const stillConnected = [...tripState.connections.values()].some(
    (remainingConnection) => remainingConnection.clientId === clientId,
  );

  if (clientId && !stillConnected) {
    const selectedSeats = tripState.selectedSeatsByClient.get(clientId);
    tripState.selectedSeatsByClient.delete(clientId);
    if (selectedSeats) {
      for (const seatNumber of selectedSeats) {
        broadcast(tripId, {
          type: "SEAT_DESELECTED", tripId, seatNumber, clientId,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }
  if (tripState.connections.size === 0) {
    realtimeStore.trips.delete(tripId);
  } else if (clientId && !stillConnected) {
    broadcastViewerCount(tripId);
  }
}

function assertSeatsAvailable(tripState: TripRealtimeState, clientId: string, seatNumbers: string[]) {
  for (const [otherClientId, otherSelectedSeats] of tripState.selectedSeatsByClient) {
    if (otherClientId === clientId) continue;
    const unavailableSeat = seatNumbers.find((seatNumber) => otherSelectedSeats.has(seatNumber));
    if (unavailableSeat) {
      throw new BusinessError(`Ghế ${unavailableSeat} không còn khả dụng. Vui lòng chọn ghế khác.`, 409);
    }
  }
}

function requireClientConnection(tripId: number, clientId: string, ownerKey: string): TripRealtimeState {
  const tripState = realtimeStore.trips.get(tripId);
  const isConnected = tripState && [...tripState.connections.values()].some(
    (connection) => connection.clientId === clientId && connection.ownerKey === ownerKey,
  );
  if (!tripState || !isConnected) {
    throw new BusinessError("Kết nối Realtime đã mất. Vui lòng kết nối lại.", 409);
  }
  return tripState;
}

export function applySeatInteraction(event: SeatInteractionEvent, ownerKey: string) {
  seatRealtimeMessageSchema.parse(event);
  const tripState = requireClientConnection(event.tripId, event.clientId, ownerKey);
  const selectedSeats = tripState.selectedSeatsByClient.get(event.clientId) ?? new Set<string>();

  if (event.type === "SEAT_SELECTED") {
    if (selectedSeats.has(event.seatNumber)) return;
    assertSeatsAvailable(tripState, event.clientId, [event.seatNumber]);
    if (selectedSeats.size >= 5) {
      throw new BusinessError("Mỗi client chỉ được chọn tối đa 5 ghế.", 409);
    }
    selectedSeats.add(event.seatNumber);
    tripState.selectedSeatsByClient.set(event.clientId, selectedSeats);
  } else {
    if (!selectedSeats.delete(event.seatNumber)) return;
    if (selectedSeats.size === 0) {
      tripState.selectedSeatsByClient.delete(event.clientId);
    }
  }
  broadcast(event.tripId, event);
}

export function synchronizeClientSeats(tripId: number, clientId: string, selectedSeats: string[], ownerKey: string) {
  const tripState = requireClientConnection(tripId, clientId, ownerKey);
  assertSeatsAvailable(tripState, clientId, selectedSeats);
  const previousSeats = tripState.selectedSeatsByClient.get(clientId) ?? new Set<string>();
  const nextSeats = new Set(selectedSeats);
  // Ghi đầy đủ trước khi phát, để snapshot luôn nhất quán.
  if (nextSeats.size === 0) {
    tripState.selectedSeatsByClient.delete(clientId);
  } else {
    tripState.selectedSeatsByClient.set(clientId, nextSeats);
  }
  for (const seatNumber of previousSeats) {
    if (!nextSeats.has(seatNumber)) {
      broadcast(tripId, { type: "SEAT_DESELECTED", tripId, seatNumber, clientId, timestamp: new Date().toISOString() });
    }
  }
  for (const seatNumber of nextSeats) {
    if (!previousSeats.has(seatNumber)) {
      broadcast(tripId, { type: "SEAT_SELECTED", tripId, seatNumber, clientId, timestamp: new Date().toISOString() });
    }
  }
}
