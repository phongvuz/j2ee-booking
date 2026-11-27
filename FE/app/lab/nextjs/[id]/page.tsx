import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { tripIdSchema } from "@/lib/trip-id";
import { formatPrice, formatTripTime } from "@/lib/trip-display";
import SeatLab from "./SeatLab";
import { getBookedSeats } from "@/services/tripService";

type TripLabData = {
  id: number;
  capacity: number;
  price: number;
  availableSeats: number;
  time: Date;
};

async function loadTrip(tripId: number): Promise<TripLabData | null> {
  // TODO 1a: chỉ lấy dữ liệu cần cho bài lab.
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: {
      id: true,
      price: true,
      availableSeats: true,
      time: true,
      // Project này lưu sức chứa ở xe, không nằm trực tiếp trong trip.
      bus: { select: { capacity: true } },
    },
  });

  if (!trip) return null;

  return {
    id: trip.id,
    capacity: trip.bus.capacity,
    price: trip.price,
    availableSeats: trip.availableSeats,
    time: trip.time,
  };
}

export default async function LabPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tripId = Number(id);

  // Chặn ID sai trước khi truy vấn DB, kể cả số vượt miền Int của Prisma.
  if (!/^\d+$/.test(id) || !tripIdSchema.safeParse(tripId).success) {
    notFound();
  }

  const trip = await loadTrip(tripId);
  if (!trip) notFound();

  // TODO 1b: chuyến đã xuất bến hoặc hết ghế thì không mở bộ chọn.
  const canSelectSeats = trip.time > new Date() && trip.availableSeats > 0;
  const initialBookedSeats = canSelectSeats
    ? await getBookedSeats(trip.id)
    : [];
  const { departureTime, dateFormatted } = formatTripTime(trip.time);

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <Link href="/trips" className="text-blue-700 underline">
        Xem danh sách chuyến xe
      </Link>
      <h1 className="text-2xl font-bold">Bài lab: Đặt vé và chọn ghế</h1>
      <section className="space-y-2 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-xl font-semibold">Chuyến xe #{trip.id}</h2>
        <p>Giá vé: {formatPrice(trip.price)}</p>
        <p>Xuất bến: {departureTime} ngày {dateFormatted}</p>
        <p>Còn {trip.availableSeats}/{trip.capacity} ghế</p>
      </section>
      {canSelectSeats ? (
        // Chỉ truyền dữ liệu cần cho bộ chọn ghế từ server sang client.
        <SeatLab
          tripId={trip.id}
          capacity={trip.capacity}
          pricePerSeat={trip.price}
          initialBookedSeats={initialBookedSeats}
        />
      ) : (
        <p role="status" className="rounded-lg bg-amber-50 p-6 text-amber-900">
          Chuyến xe đã xuất bến hoặc hết ghế. Vui lòng chọn chuyến khác.
        </p>
      )}
    </main>
  );
}
