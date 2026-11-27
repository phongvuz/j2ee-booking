// Đáp án phần A và B, đề 18: dữ liệu giả và mốc NOW cố định theo ảnh đề.
// Phần A: node --experimental-strip-types exam18.ts
// Phần B: node --experimental-strip-types exam18.ts B
// Bản Next.js dùng DB thật: app/lab/nextjs/[id]/page.tsx và SeatLab.tsx.
import { z } from "zod";

const NOW = new Date("2026-11-20T08:00:00+07:00");
const TRIPS = [
  { id: 6, capacity: 34, price: 300000, availableSeats: 31, time: new Date("2026-11-21T07:30:00+07:00"), driver: "Tài xế A", route: "SG-DL" },
  { id: 7, capacity: 34, price: 280000, availableSeats: 0, time: new Date("2026-11-21T09:00:00+07:00"), driver: "Tài xế B", route: "SG-VT" },
  { id: 8, capacity: 22, price: 350000, availableSeats: 16, time: new Date("2026-11-19T22:00:00+07:00"), driver: "Tài xế C", route: "SG-CT" },
];
const BOOKED: Record<number, string[]> = {
  6: ["A01", "A02", "B05"],
  7: [],
  8: ["A01"],
};

type Trip = (typeof TRIPS)[number];
type TripLabData = Pick<Trip, "id" | "capacity" | "price" | "availableSeats" | "time">;

// Prisma giả: chỉ trả về những trường có select: true.
const prisma = {
  trip: {
    async findUnique(args: {
      where: { id: number };
      select: Record<keyof TripLabData, boolean>;
    }): Promise<TripLabData | null> {
      const trip = TRIPS.find((item) => item.id === args.where.id);
      if (!trip) return null;
      const keys = Object.keys(args.select) as (keyof TripLabData)[];
      return Object.fromEntries(
        keys.filter((key) => args.select[key]).map((key) => [key, trip[key]])
      ) as TripLabData;
    },
  },
};

async function getBookedSeats(tripId: number) {
  return [...(BOOKED[tripId] ?? [])];
}

class NotFound extends Error {}
function notFound(): never {
  throw new NotFound("NEXT_NOT_FOUND");
}
const tripIdSchema = z.number().int().positive();

// TODO 1a: chỉ select đúng 5 trường đề yêu cầu.
async function loadTrip(tripId: number): Promise<TripLabData | null> {
  return prisma.trip.findUnique({
    where: {
      id: tripId,
    },
    select: {
      id: true,
      capacity: true,
      price: true,
      availableSeats: true,
      time: true,
    },
  });
}

async function LabPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const parsed = tripIdSchema.safeParse(Number(id));
  if (!parsed.success) notFound();
  const trip = await loadTrip(parsed.data);
  if (!trip) notFound();

  // TODO 1b: dừng trước khi lấy ghế và trả bộ chọn SeatLab.
  if (
    trip.time.getTime() <= NOW.getTime() ||
    trip.availableSeats <= 0
  ) {
    return {
      view: "Chuyến đã xuất bến hoặc hết ghế, vui lòng chọn chuyến khác.",
    };
  }

  const initialBookedSeats = await getBookedSeats(trip.id);
  return {
    view: "SeatLab",
    props: {
      tripId: trip.id,
      capacity: trip.capacity,
      pricePerSeat: trip.price,
      initialBookedSeats,
    },
  };
}

type Live = {
  selectedSeats: string[];
  remoteSeats: { seatNumber: string }[];
  bookedSeats: string[];
  heldSeatNumbers: string[];
  isConnected: boolean;
  isSending: boolean;
};

// TODO 2: giữ nguyên thứ tự booked, selected, remote, disabled để đối chiếu output.
function seatButton(live: Live, seatNumber: string) {
  const booked = live.bookedSeats.includes(seatNumber);
  const selected = live.selectedSeats.includes(seatNumber);
  const remote = !selected && (
    live.remoteSeats.some((item) => item.seatNumber === seatNumber) ||
    live.heldSeatNumbers.includes(seatNumber)
  );
  const disabled = !live.isConnected || live.isSending || booked || remote;
  return { booked, selected, remote, disabled };
}

// TODO 3: tripId phải là number; clientId/seatNumber không được rỗng.
const seatEventSchema = z.object({
  tripId: z.number().int().positive(),
  clientId: z.string().min(1),
  seatNumber: z.string().min(1),
  type: z.enum(["SEAT_SELECTED", "SEAT_DESELECTED"]),
});

function validateSeatEvent(body: unknown): { status: number; error?: string } {
  const r = seatEventSchema.safeParse(body);
  return r.success
    ? { status: 200 }
    : { status: 400, error: r.error.issues.map((i) => i.path.join(".")).join(",") };
}

// TODO B: kiểm tra ID trước khi tạo stream; không truy vấn DB trong phần này.
async function streamGET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  if (!/^\d+$/.test(id) || !tripIdSchema.safeParse(Number(id)).success) {
    return Response.json({ error: "ID chuyến không hợp lệ" }, { status: 400 });
  }

  const { readable } = new TransformStream<Uint8Array, Uint8Array>();
  return new Response(readable, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}

// Harness theo đề: tham số B chạy 5 ID; mặc định chạy phần A.
const P = (id: string) => ({ params: Promise.resolve({ id }) });
if (process.argv[2] === "B") {
  for (const id of ["invalid", "6", "0", "007", "-3"]) {
    const res = await streamGET(new Request(`http://localhost:3000/api/trips/${id}/stream`), P(id));
    console.log(`GET /api/trips/${id}/stream -> ${res.status} ${res.headers.get("content-type")} ${res.status >= 400 ? await res.text() : ""}`.trim());
  }
} else {
  for (const id of ["6", "abc", "0", "99", "7", "8", "1e2"]) {
    try {
      console.log(`/lab/nextjs/${id} -> ${JSON.stringify(await LabPage(P(id)))}`);
    } catch (e) {
      console.log(`/lab/nextjs/${id} -> ${e instanceof NotFound ? "not-found" : "Error: " + (e as Error).message}`);
    }
  }
  const live: Live = {
    selectedSeats: ["A03"],
    remoteSeats: [{ seatNumber: "A04" }],
    bookedSeats: ["A01", "A02", "B05"],
    heldSeatNumbers: ["B01"],
    isConnected: true,
    isSending: false,
  };
  for (const s of ["A01", "A03", "A04", "B01", "C02"]) {
    console.log(`ghe ${s} -> ${JSON.stringify(seatButton(live, s))}`);
  }
  console.log(`chua ket noi, ghe C02 -> ${JSON.stringify(seatButton({ ...live, isConnected: false }, "C02"))}`);
  for (const [label, body] of [
    ["T3 tripId chuoi", { tripId: "6", clientId: "lab-invalid-type", seatNumber: "A01", type: "SEAT_SELECTED" }],
    ["hop le", { tripId: 6, clientId: "c-1", seatNumber: "A03", type: "SEAT_SELECTED" }],
    ["type sai", { tripId: 6, clientId: "c-1", seatNumber: "A03", type: "SEAT_HELD" }],
    ["thieu clientId", { tripId: 6, seatNumber: "A03", type: "SEAT_DESELECTED" }],
  ] as const) {
    console.log(`POST seat-events ${label} -> ${JSON.stringify(validateSeatEvent(body))}`);
  }
}
