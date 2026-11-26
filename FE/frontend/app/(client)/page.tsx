import { FiArrowRight } from "react-icons/fi";
import HomeHero from "@/components/home/HomeHero";
import SearchWidget from "@/components/home/SearchWidget";
import FeaturedDestinations from "@/components/home/FeaturedDestinations";
import TravelGuides from "@/components/home/TravelGuides";
import TravelRoadmap from "@/components/home/TravelRoadmap";
import RouteCard from "@/components/RouteCard";
import Link from "next/link";
import { connection } from "next/server";
import { getFeaturedRoutes, getTripSearchOptions } from "@/services/tripService";
import { ROUTE_IMAGES } from "@/lib/home-content";

export default async function Home() {
  await connection();
  const [routes, searchOptions] = await Promise.all([getFeaturedRoutes(), getTripSearchOptions()]);
  return (
    <div className="flex flex-col bg-brand-bg">
      <HomeHero />

      <SearchWidget options={searchOptions} />

      <FeaturedDestinations />

      <TravelGuides />

      <section id="open-routes" className="w-full py-16 md:py-20 bg-white border-t border-brand-light">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-10 gap-4">
            <div>
              <h2 className="font-serif font-black text-3xl sm:text-4xl text-brand-text tracking-tight">
                Các tuyến xe đang mở bán
              </h2>
            </div>
            <Link
              href="/trips"
              className="text-brand-primary hover:text-brand-dark font-semibold text-sm inline-flex items-center gap-1 group"
            >
              Xem tất cả chuyến xe
              <span className="group-hover:translate-x-1 transition-transform"><FiArrowRight aria-hidden="true" className="inline-block shrink-0 align-middle" /></span>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {routes.map((route) => (
              <RouteCard key={`${route.from}-${route.to}`} from={route.from} to={route.to}
                price={route._min.price ?? 0} imageUrl={ROUTE_IMAGES[route.to] ?? "/images/beach.jpg"}
                href={`/trips?${new URLSearchParams({ from: route.from, to: route.to })}`} />
            ))}
            {routes.length === 0 && (
              <div className="col-span-full rounded-2xl border border-brand-border bg-brand-bg p-8 text-center">
                <p className="font-semibold text-brand-text">Hiện chưa có tuyến xe đang mở bán.</p>
                <p className="mt-2 text-sm text-slate-500">Các chuyến đã khởi hành hoặc hết ghế không xuất hiện ở đây.</p>
                <Link href="/trips" className="mt-4 inline-block font-medium text-brand-primary hover:underline">
                  Xem lịch trình chuyến xe <FiArrowRight aria-hidden="true" className="inline-block shrink-0 align-middle" />
                </Link>
              </div>
            )}

          </div>
        </div>
      </section>
      
      <TravelRoadmap />
    </div>
  );
}
