"use client";

import { useEffect, useRef, useState } from "react";
import { getErrorMessage, requestJson } from "@/lib/api-client";
import { getSeatCodes } from "@/lib/seats";
import { availableSeatSelection, type TripSeatState } from "@/lib/seat-selection";
import { seatRealtimeMessageSchema } from "@/lib/validations/seat-realtime";
import type { SeatInteractionEvent, SeatInteractionRequest, SeatSelection } from "@/types/seat-realtime";

function updateRemoteSelections(previous: SeatSelection[], event: SeatInteractionEvent): SeatSelection[] {
  const remaining = previous.filter((selection) => selection.clientId !== event.clientId || selection.seatNumber !== event.seatNumber);
  return event.type === "SEAT_DESELECTED" ? remaining : [...remaining, { clientId: event.clientId, seatNumber: event.seatNumber }];
}

export function useSeatRealtime(tripId: number, capacity: number, initialBookedSeats: string[] = []) {
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [remoteSeats, setRemoteSeats] = useState<SeatSelection[]>([]);
  const [bookedSeats, setBookedSeats] = useState(initialBookedSeats);
  const [heldSeatNumbers, setHeldSeatNumbers] = useState<string[]>([]);
  const [liveCapacity, setLiveCapacity] = useState(capacity);
  const [isConnected, setIsConnected] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [viewerCount, setViewerCount] = useState<number | null>(null);
  const [sendError, setSendError] = useState("");
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const clientIdReference = useRef("");
  const selectedSeatsReference = useRef<string[]>([]);
  const isSendingReference = useRef(false);
  const isConnectedReference = useRef(false);
  const isMountedReference = useRef(false);
  const connectionAbortReference = useRef<AbortController | null>(null);
  const tripIdReference = useRef(tripId);

  useEffect(() => {
    isMountedReference.current = true;
    isConnectedReference.current = false;
    isSendingReference.current = false;
    if (tripIdReference.current !== tripId) {
      selectedSeatsReference.current = [];
      tripIdReference.current = tripId;
    }
    if (!clientIdReference.current) {
      clientIdReference.current = typeof crypto.randomUUID === "function"
        ? crypto.randomUUID() : `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    const clientId = clientIdReference.current;
    const abortController = new AbortController();
    connectionAbortReference.current = abortController;
    let eventSource: EventSource | undefined;
    let retryTimer: number | undefined;
    let synchronizing = false;
    let refreshing: Promise<boolean> | undefined;
    let validSeatNumbers = new Set(getSeatCodes(capacity));
    const signal = () => AbortSignal.any([abortController.signal, AbortSignal.timeout(10000)]);

    function refreshSeats(): Promise<boolean> {
      if (refreshing) return refreshing;
      refreshing = (async () => {
        const state = await requestJson<TripSeatState>(`/api/trips/${tripId}/holds?clientId=${encodeURIComponent(clientId)}`, { signal: signal() });
        if (abortController.signal.aborted) return false;
        validSeatNumbers = new Set(getSeatCodes(state.capacity));
        setLiveCapacity(state.capacity);
        setBookedSeats(state.bookedSeats);
        setHeldSeatNumbers(state.holds.filter((hold) => !hold.isOwn).map((hold) => hold.seatNumber));
        setRemoteSeats(state.selections.filter((selection) => selection.clientId !== clientId && validSeatNumbers.has(selection.seatNumber) && !state.bookedSeats.includes(selection.seatNumber)));
        const available = availableSeatSelection(selectedSeatsReference.current, state, clientId);
        const changed = available.length !== selectedSeatsReference.current.length;
        if (changed) {
          selectedSeatsReference.current = available;
          setSelectedSeats(available);
          setSendError("Một số ghế không còn khả dụng. Vui lòng kiểm tra lựa chọn của bạn.");
        }
        return changed;
      })().finally(() => { refreshing = undefined; });
      return refreshing;
    }

    async function synchronizeSelections() {
      if (synchronizing || isSendingReference.current || eventSource?.readyState !== EventSource.OPEN) return;
      synchronizing = true;
      try {
        for (let attempt = 0; attempt < 2; attempt++) {
          await refreshSeats();
          try {
            await requestJson(`/api/trips/${tripId}/seat-events`, {
              method: "PUT", body: JSON.stringify({ tripId, clientId, selectedSeats: selectedSeatsReference.current }), signal: signal(),
            });
            break;
          } catch (error) {
            if (attempt === 1) throw error;
          }
        }
        if (abortController.signal.aborted || eventSource?.readyState !== EventSource.OPEN) return;
        isConnectedReference.current = true;
        setIsConnected(true);
        setConnectionError("");
      } catch (error) {
        if (abortController.signal.aborted) return;
        isConnectedReference.current = false;
        setIsConnected(false);
        setConnectionError(getErrorMessage(error, "Không thể đồng bộ ghế. Hãy thử kết nối lại."));
        // A concurrently opened tab may have established the browser cookie first.
        // Reopen SSE so its private owner binding uses the cookie now in the browser.
        if (typeof error === "object" && error !== null && "status" in error && error.status === 409) {
          eventSource?.close();
          retryTimer = window.setTimeout(() => setConnectionAttempt((previous) => previous + 1), 1000);
        }
      } finally {
        synchronizing = false;
      }
    }

    async function reconcile() {
      try {
        const changed = await refreshSeats();
        if (changed || !isConnectedReference.current) await synchronizeSelections();
      } catch (error) {
        if (!abortController.signal.aborted) setConnectionError(getErrorMessage(error, "Không thể cập nhật sơ đồ ghế."));
      }
    }

    function handleMessage(message: MessageEvent<string>) {
      let receivedData: unknown;
      try { receivedData = JSON.parse(message.data); }
      catch { setConnectionError("Server gửi dữ liệu Realtime không hợp lệ."); return; }
      const parsed = seatRealtimeMessageSchema.safeParse(receivedData);
      if (!parsed.success) { setConnectionError("Server gửi dữ liệu Realtime không hợp lệ."); return; }
      const event = parsed.data;
      if (event.tripId !== tripId) return;
      if (event.type === "SEATS_CHANGED") { void reconcile(); return; }
      if (event.type === "VIEWERS_UPDATED") { setViewerCount(event.viewerCount); return; }
      if (event.type === "SEAT_SNAPSHOT") {
        setViewerCount(event.viewerCount);
        setBookedSeats(event.bookedSeats);
        setRemoteSeats(event.selections.filter((selection) => selection.clientId !== clientId));
        void synchronizeSelections();
        return;
      }
      if (!validSeatNumbers.has(event.seatNumber) || event.clientId === clientId) return;
      setRemoteSeats((previous) => updateRemoteSelections(previous, event));
    }

    function handleConnectionError() {
      isConnectedReference.current = false;
      setIsConnected(false);
      setConnectionError("Mất kết nối Realtime. Trình duyệt đang thử kết nối lại…");
    }
    function handleOffline() {
      eventSource?.close();
      handleConnectionError();
    }
    function handleOnline() { setConnectionAttempt((previous) => previous + 1); }

    async function connect() {
      try {
        // Establish the HttpOnly session before opening SSE or submitting mutations.
        await refreshSeats();
        if (abortController.signal.aborted) return;
        setIsConnected(false);
        setIsSending(false);
        setSelectedSeats(selectedSeatsReference.current);
        eventSource = new EventSource(`/api/trips/${tripId}/stream?clientId=${encodeURIComponent(clientId)}`);
        eventSource.addEventListener("message", handleMessage);
        eventSource.addEventListener("error", handleConnectionError);
        if (!navigator.onLine) handleOffline();
      } catch (error) {
        if (!abortController.signal.aborted) setConnectionError(getErrorMessage(error, "Không thể kết nối sơ đồ ghế."));
      }
    }
    void connect();
    const poll = window.setInterval(() => { void reconcile(); }, 5000);
    const timeout = window.setTimeout(() => {
      if (!isConnectedReference.current) setConnectionError("Chưa kết nối được Realtime. Kiểm tra mạng hoặc thử kết nối lại.");
    }, 10000);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      isMountedReference.current = false;
      isConnectedReference.current = false;
      abortController.abort();
      window.clearInterval(poll);
      window.clearTimeout(timeout);
      window.clearTimeout(retryTimer);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      eventSource?.close();
    };
  }, [tripId, capacity, connectionAttempt]);

  function reconnect() {
    isConnectedReference.current = false;
    setIsConnected(false);
    setConnectionError("");
    setConnectionAttempt((previous) => previous + 1);
  }

  async function toggleSeat(seatNumber: string) {
    if (isSendingReference.current) return;
    if (!isConnectedReference.current) { setSendError("Chưa kết nối Realtime. Vui lòng kết nối lại trước khi chọn ghế."); return; }
    const previousSeats = selectedSeatsReference.current;
    const isSelected = previousSeats.includes(seatNumber);
    if (!isSelected && (bookedSeats.includes(seatNumber) || heldSeatNumbers.includes(seatNumber) || remoteSeats.some((selection) => selection.seatNumber === seatNumber))) return;
    if (!isSelected && previousSeats.length >= 5) { setSendError("Bạn chỉ được chọn tối đa 5 ghế trong một lượt đặt."); return; }
    const nextSeats = isSelected ? previousSeats.filter((seat) => seat !== seatNumber) : [...previousSeats, seatNumber];
    const request: SeatInteractionRequest = { tripId, seatNumber, clientId: clientIdReference.current, type: isSelected ? "SEAT_DESELECTED" : "SEAT_SELECTED" };
    const abortController = connectionAbortReference.current;
    if (!abortController) return;
    selectedSeatsReference.current = nextSeats;
    setSelectedSeats(nextSeats);
    setSendError("");
    isSendingReference.current = true;
    setIsSending(true);
    try {
      await requestJson(`/api/trips/${tripId}/seat-events`, {
        method: "POST", body: JSON.stringify(request), signal: AbortSignal.any([abortController.signal, AbortSignal.timeout(10000)]),
      });
    } catch (error) {
      if (!isMountedReference.current || abortController.signal.aborted) return;
      selectedSeatsReference.current = previousSeats;
      setSelectedSeats(previousSeats);
      setSendError(getErrorMessage(error, "Không thể gửi thao tác chọn ghế."));
      reconnect();
    } finally {
      if (connectionAbortReference.current === abortController) {
        isSendingReference.current = false;
        if (isMountedReference.current) setIsSending(false);
      }
    }
  }

  return { selectedSeats, remoteSeats, bookedSeats, heldSeatNumbers, capacity: liveCapacity, getClientId: () => clientIdReference.current,
    isConnected, isSending, connectionError, viewerCount, sendError, toggleSeat, reconnect };
}
