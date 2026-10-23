import Link from "next/link";
import { notFound } from "next/navigation";
import { tripsDatabase } from "@/app/lib/db";
import SeatSelector from "./SeatSelector";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TripDetailPage({ params }: PageProps) {
  const resolvedParams = await params;
  const tripId = resolvedParams.id;

  const tripInfo = tripsDatabase.find((trip) => trip.id === tripId);
  if (!tripInfo) {
    notFound();
  }

  return (
    <div className="bg-gray-100 min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4">
        
        {/* Back Link & Header */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between">
          <Link
            href="/trips"
            className="text-blue-600 hover:underline inline-flex items-center gap-1 font-medium mb-4 md:mb-0"
          >
            <span>&larr;</span> Quay lại danh sách
          </Link>
          <h2 className="text-2xl font-bold text-gray-800">
            Chi tiết chuyến xe: <span className="text-[#ef5222]">{tripInfo.id}</span>
          </h2>
        </div>

        {/* Thông tin hành trình */}
        <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-lg mb-8">
          <h3 className="text-lg font-bold border-b border-gray-100 pb-3 mb-5 text-gray-800">
            Thông tin hành trình
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-gray-500 text-sm mb-1">Tuyến xe</p>
              <p className="font-bold text-gray-900">
                {tripInfo.from} ➔ {tripInfo.to}
              </p>
            </div>
            <div>
              <p className="text-gray-500 text-sm mb-1">Giờ xuất bến</p>
              <p className="font-bold text-gray-900">{tripInfo.time}</p>
            </div>
            <div>
              <p className="text-gray-500 text-sm mb-1">Ngày đi</p>
              <p className="font-bold text-gray-900">{tripInfo.date}</p>
            </div>
            <div>
              <p className="text-gray-500 text-sm mb-1">Giá vé</p>
              <p className="font-extrabold text-xl text-[#ef5222]">{tripInfo.price}</p>
            </div>
          </div>
        </div>

        {/* Component Sơ đồ ghế và Thanh toán */}
        <SeatSelector tripId={tripInfo.id} pricePerSeatStr={tripInfo.price} />

      </div>
    </div>
  );
}
