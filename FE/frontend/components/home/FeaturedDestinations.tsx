import { FiArrowRight, FiMapPin } from "react-icons/fi";
import Image from "next/image";
import Link from "next/link";
import { DESTINATIONS } from "./content";

export default function FeaturedDestinations() {
  return (
    <section id="destinations" className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 md:py-20 lg:px-8">
      <div className="mb-8">
        <h2 className="font-serif text-3xl font-black text-brand-text sm:text-4xl">
          Điểm đến nổi bật
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:grid-rows-[220px_220px]">
        {DESTINATIONS.map((destination) => (
          <Link
            key={destination.id}
            href={`/trips?${new URLSearchParams({ to: destination.tripDestination })}`}
            className={`group relative block overflow-hidden rounded-3xl shadow-lg transition-shadow hover:shadow-2xl ${
              destination.large
                ? "h-[380px] sm:h-[460px] lg:col-span-7 lg:row-span-2"
                : "h-[220px] lg:col-span-5"
            }`}
          >
            <Image
              src={destination.imageUrl}
              alt={destination.title}
              fill
              sizes={
                destination.large
                  ? "(min-width: 1024px) 58vw, 100vw"
                  : "(min-width: 1024px) 42vw, (min-width: 640px) 50vw, 100vw"
              }
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />

            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-6">
              <div>
                <h3 className="font-serif text-2xl font-black text-white group-hover:text-emerald-200">
                  {destination.title}
                </h3>
                <p className="mt-1.5 text-sm font-medium text-white/90">
                  <FiMapPin aria-hidden="true" className="inline-block shrink-0 align-middle" /> {destination.location} • {destination.duration}
                </p>
              </div>

              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-brand-text transition-colors group-hover:bg-brand-primary group-hover:text-white"
              >
                <FiArrowRight aria-hidden="true" className="inline-block shrink-0 align-middle" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
