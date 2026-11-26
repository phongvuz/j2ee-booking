import { FiArrowLeft, FiArrowRight } from "react-icons/fi";
import type { TripSearchParams } from "@/types";
import { resolveLocationName } from "@/lib/trip-display";
import Link from "next/link";
import TripListWithFilter from "@/components/trips/TripFilter";
import { queryPublicTrips } from "@/services/tripService";
import { parsePublicTripFilters } from "@/lib/public-trip-search";


export default async function TripsPage({
  searchParams,
}: {
  searchParams: Promise<TripSearchParams>;
}) {
  const filters = parsePublicTripFilters(await searchParams);
  const fromQuery = filters.from;
  const toQuery = filters.to;

  const fromCity = resolveLocationName(fromQuery);
  const toCity = resolveLocationName(toQuery);

  const { data: trips, pagination } = await queryPublicTrips({
    fromCity,
    toCity,
    date: filters.date,
    times: filters.times,
    vehicles: filters.vehicles,
    page: filters.page,
  });
  if (process.env.NODE_ENV === "development") {
    console.info("[TripsPage/server] queryPublicTrips completed", {
      pid: process.pid,
      rows: trips.length,
      total: pagination.total,
    });
  }
  return (
    <div className="bg-gray-100 min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header tìm kiếm */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6 flex flex-col md:flex-row md:items-center justify-between border border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Kết quả tìm kiếm</h2>
            <p className="text-gray-600">
              Tuyến:{" "}
              <span className="font-bold text-brand-primary">
                {fromCity || fromQuery || "Tất cả điểm đi"}
              </span>{" "}
              <FiArrowRight aria-hidden="true" className="inline-block shrink-0 align-middle" />{" "}
              <span className="font-bold text-brand-primary">
                {toCity || toQuery || "Tất cả điểm đến"}
              </span>
              <span className="mx-2">|</span>
              Ngày đi: <span className="font-bold">{filters.date || "Tất cả ngày"}</span>
            </p>
          </div>
          <Link
            href="/"
            className="mt-4 md:mt-0 text-blue-600 font-medium hover:underline flex items-center gap-1"
          >
            <span><FiArrowLeft aria-hidden="true" className="inline-block shrink-0 align-middle" /></span> Thay đổi tìm kiếm
          </Link>
        </div>

        <TripListWithFilter initialTrips={trips} filters={filters} pagination={pagination} />
      </div>
    </div>
  );
}
