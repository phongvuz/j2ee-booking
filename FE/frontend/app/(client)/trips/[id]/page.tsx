import { FiArrowLeft, FiArrowRight } from "react-icons/fi";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatTripTime, formatPrice } from "@/lib/trip-display";
import { getBookedSeats } from "@/services/tripService";
import SeatSelector from "@/components/trips/SeatSelector";
import { tripIdSchema } from "@/lib/trip-id";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TripDetailPage({ params }: PageProps) {
  const resolvedParams = await params;
  const tripId = Number(resolvedParams.id);

  if (!/^\d+$/.test(resolvedParams.id) || !tripIdSchema.safeParse(tripId).success) notFound();

  const tripInfo = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { bus: true },
  });

  if (!tripInfo) {
    notFound();
  }

  const bookedSeats = await getBookedSeats(tripInfo.id);

  const { departureTime, dateFormatted } = formatTripTime(tripInfo.time);
  const formattedPrice = formatPrice(tripInfo.price);

  return (
    <div className="bg-gray-100 min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between">
          <Link
            href="/trips"
            className="text-blue-600 hover:underline inline-flex items-center gap-1 font-medium mb-4 md:mb-0"
          >
            <span><FiArrowLeft aria-hidden="true" className="inline-block shrink-0 align-middle" /></span> Quay lại danh sách
          </Link>
          <h2 className="text-2xl font-bold text-gray-800">
            Chi tiết chuyến xe: <span className="text-brand-primary">{tripInfo.id}</span>
          </h2>
        </div>

        <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-lg mb-8">
          <div className="flex justify-between items-center border-b border-gray-100 pb-3 mb-5">
            <h3 className="text-lg font-bold text-gray-800">
              Thông tin hành trình 
            </h3>
            <span className="bg-green-100 text-green-800 text-xs px-2.5 py-1 rounded-full font-semibold">
              Còn {tripInfo.availableSeats} ghế trống
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <div>
              <p className="text-gray-500 text-sm mb-1">Tuyến xe</p>
              <p className="font-bold text-gray-900">
                {tripInfo.from} <FiArrowRight aria-hidden="true" className="inline-block shrink-0 align-middle" /> {tripInfo.to}
              </p>
            </div>
            <div>
              <p className="text-gray-500 text-sm mb-1">Giờ xuất bến</p>
              <p className="font-bold text-gray-900">{departureTime}</p>
            </div>
            <div>
              <p className="text-gray-500 text-sm mb-1">Ngày đi</p>
              <p className="font-bold text-gray-900">{dateFormatted}</p>
            </div>
            <div>
              <p className="text-gray-500 text-sm mb-1">Giá vé</p>
              <p className="font-extrabold text-xl text-brand-primary">{formattedPrice}</p>
            </div>
            <div>
              <p className="text-gray-500 text-sm mb-1">Xe phục vụ</p>
              <p className="font-bold text-gray-900">{tripInfo.bus.plate}</p>
            </div>
            <div>
              <p className="text-gray-500 text-sm mb-1">Loại xe và sức chứa</p>
              <p className="font-bold text-gray-900">{tripInfo.bus.type} · {tripInfo.bus.capacity} chỗ</p>
            </div>
          </div>
        </div>

        {tripInfo.status === "OPEN" && tripInfo.time > new Date() && tripInfo.availableSeats > 0 ? <SeatSelector
          key={tripInfo.id}
          capacity={tripInfo.bus.capacity}
          tripId={tripInfo.id}
          pricePerSeat={tripInfo.price}
          bookedSeats={bookedSeats}
        /> : <p className="rounded-lg bg-white p-6 text-gray-600">Chuyến xe đã xuất bến hoặc hết ghế. Vui lòng chọn chuyến khác.</p>}
      </div>
    </div>
  );
}
