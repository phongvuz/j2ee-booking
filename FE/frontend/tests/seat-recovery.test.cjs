const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./load-ts.cjs");

// Run the real hook with deterministic transport and timers, without a server or database.
test("hook reconnects after an offline seat sale and refreshes cancellations without reloading", async () => {
  const slots = [];
  let cursor = 0;
  let scheduled = false;
  let mounted = true;
  let current;
  let useSeatRealtime;
  const effects = [];
  const listeners = new Map();
  const intervals = new Map();
  const timeouts = new Map();
  let timerId = 0;
  const server = { capacity: 6, bookedSeats: [], holds: [], selections: [] };
  const requests = [];
  const sources = [];
  let syncFailureStatus = 0;
  const originalGlobals = new Map();
  const flush = async () => { for (let index = 0; index < 12; index++) await new Promise(setImmediate); };
  function schedule() {
    if (scheduled || !mounted) return;
    scheduled = true;
    queueMicrotask(() => { scheduled = false; if (mounted) render(); });
  }
  function render() {
    cursor = 0;
    current = useSeatRealtime(42, 6, []);
    while (effects.length) effects.shift()();
  }
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: typeof initial === "function" ? initial() : initial };
      return [slots[index].value, (next) => {
        const value = typeof next === "function" ? next(slots[index].value) : next;
        if (!Object.is(value, slots[index].value)) { slots[index].value = value; schedule(); }
      }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { current: initial };
      return slots[index];
    },
    useEffect(effect, dependencies) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || dependencies.some((value, i) => !Object.is(value, previous.dependencies[i]))) {
        effects.push(() => {
          previous?.cleanup?.();
          slots[index] = { dependencies, cleanup: effect() };
        });
      }
    },
  };
  class FakeEventSource {
    static OPEN = 1;
    constructor(url) {
      this.readyState = FakeEventSource.OPEN;
      this.clientId = new URL(url, "http://localhost").searchParams.get("clientId");
      this.listeners = new Map();
      sources.push(this);
      queueMicrotask(() => this.emit({ type: "SEAT_SNAPSHOT", tripId: 42, selections: server.selections, bookedSeats: server.bookedSeats, viewerCount: 1, timestamp: new Date().toISOString() }));
    }
    addEventListener(type, callback) { this.listeners.set(type, callback); }
    emit(event) { this.listeners.get("message")?.({ data: JSON.stringify(event) }); }
    close() {
      this.readyState = 2;
      server.selections = server.selections.filter((selection) => selection.clientId !== this.clientId);
    }
  }
  const windowMock = {
    setInterval(callback) { const id = ++timerId; intervals.set(id, callback); return id; },
    clearInterval(id) { intervals.delete(id); },
    setTimeout(callback, delay) { const id = ++timerId; timeouts.set(id, { callback, delay }); return id; },
    clearTimeout(id) { timeouts.delete(id); },
    addEventListener(type, callback) { listeners.set(type, callback); },
    removeEventListener(type, callback) { if (listeners.get(type) === callback) listeners.delete(type); },
  };
  for (const [name, value] of Object.entries({ window: windowMock, EventSource: FakeEventSource, navigator: { onLine: true } })) {
    originalGlobals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, value });
  }
  try {
    ({ useSeatRealtime } = load("hooks/useSeatRealtime.ts", {
      react,
      "@/lib/api-client": {
        getErrorMessage: (error) => error.message,
        requestJson: async (url, options = {}) => {
          if (url.includes("/holds?")) return structuredClone(server);
          const body = JSON.parse(options.body);
          requests.push({ method: options.method, ...body });
          if (options.method === "PUT" && syncFailureStatus) throw Object.assign(new Error("Sync rejected"), { status: syncFailureStatus });
          const selected = options.method === "PUT" ? body.selectedSeats : body.type === "SEAT_SELECTED" ? [body.seatNumber] : [];
          if (selected.some((seat) => server.bookedSeats.includes(seat))) throw Object.assign(new Error("Seat booked"), { status: 409 });
          if (options.method === "PUT") server.selections = server.selections.filter((selection) => selection.clientId !== body.clientId)
            .concat(selected.map((seatNumber) => ({ seatNumber, clientId: body.clientId })));
          else if (body.type === "SEAT_SELECTED") server.selections.push({ clientId: body.clientId, seatNumber: body.seatNumber });
          else server.selections = server.selections.filter((selection) => selection.clientId !== body.clientId || selection.seatNumber !== body.seatNumber);
          return { success: true };
        },
      },
    }));
    render();
    await flush();
    assert.equal(current.isConnected, true);
    const beforeForbidden = sources.length;
    syncFailureStatus = 403;
    current.reconnect();
    await flush();
    assert.equal(current.isConnected, false);
    assert.equal(sources.length, beforeForbidden + 1, "a permanent origin rejection must not trigger an immediate reconnect loop");
    assert.equal([...timeouts.values()].some(({ delay }) => delay === 1000), false);

    syncFailureStatus = 409;
    current.reconnect();
    await flush();
    const retry = [...timeouts.values()].find(({ delay }) => delay === 1000);
    assert.ok(retry, "private owner conflicts should reconnect after a delay");
    const beforeRetry = sources.length;
    syncFailureStatus = 0;
    retry.callback();
    await flush();
    assert.equal(sources.length, beforeRetry + 1);
    assert.equal(current.isConnected, true);
    await current.toggleSeat("A01");
    await flush();
    assert.deepEqual(current.selectedSeats, ["A01"]);

    listeners.get("offline")();
    server.bookedSeats = ["A01"];
    listeners.get("online")();
    await flush();
    assert.equal(current.isConnected, true);
    assert.deepEqual(current.selectedSeats, []);
    assert.deepEqual(current.bookedSeats, ["A01"]);
    assert.ok(requests.filter((request) => request.method === "PUT").every((request) => !request.selectedSeats.includes("A01")));

    server.bookedSeats = [];
    sources.at(-1).emit({ type: "SEATS_CHANGED", tripId: 42, timestamp: new Date().toISOString() });
    await flush();
    assert.deepEqual(current.bookedSeats, []);
    await current.toggleSeat("A01");
    await flush();
    assert.deepEqual(current.selectedSeats, ["A01"]);

    // Polling also repairs missed notifications and changed capacity.
    server.capacity = 1;
    server.bookedSeats = ["A01"];
    await Promise.all([...intervals.values()].map((callback) => callback()));
    await flush();
    assert.deepEqual(current.selectedSeats, []);
    assert.deepEqual(current.bookedSeats, ["A01"]);
    assert.equal(current.capacity, 1);
    assert.equal(current.isConnected, true);
  } finally {
    mounted = false;
    for (const slot of slots) slot?.cleanup?.();
    for (const [name, descriptor] of originalGlobals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
});
