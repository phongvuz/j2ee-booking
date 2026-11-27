import { FiChevronRight } from "react-icons/fi";
import Image from "next/image";
import Link from "next/link";

import { GUIDES } from "./content";

export default function TravelGuides() {
  return (
    <section id="guides" className="w-full py-16 md:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
        <div>
          <h2 className="font-serif font-black text-3xl sm:text-4xl text-brand-text tracking-tight">
            Khám phá những hành trình mới
          </h2>
        </div>


      </div>

      {/* 3 Column Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-7">
        {GUIDES.map((guide) => (
          <Link
            key={guide.id}
            href={guide.link}
            className="group block bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl border border-brand-light transition-all duration-300"
          >
            {/* Top Image */}
            <div className="h-48 sm:h-52 w-full overflow-hidden relative bg-slate-100">
              <Image
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                src={guide.imageUrl}
                alt={guide.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>

            {/* Bottom Bar matching screenshot */}
            <div className="p-4 sm:p-5 flex items-center justify-between gap-3 bg-white">
              <div className="flex items-center gap-3">
                {/* Circular Icon */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${guide.iconBg}`}
                >
                  {guide.icon}
                </div>

                {/* Text details */}
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-brand-text group-hover:text-brand-primary transition-colors">
                    {guide.title}
                  </h3>
                  <p className="text-xs text-slate-500">{guide.subtitle}</p>
                </div>
              </div>

              {/* Chevron arrow */}
              <div className="text-slate-400 group-hover:text-brand-primary group-hover:translate-x-1 transition-all">
                <FiChevronRight aria-hidden="true" className="w-4 h-4" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
