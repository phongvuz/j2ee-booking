import Image from "next/image";
import Link from "next/link";
import { FaAngleDoubleRight, FaPaperPlane } from "react-icons/fa";

export default function HomeHero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-brand-light via-brand-bg to-brand-bg pt-12 pb-24 md:pt-16 md:pb-28">

      <div className="absolute -top-10 -left-10 w-64 h-64 opacity-25 pointer-events-none text-brand-primary">
        <svg viewBox="0 0 200 200" fill="currentColor">
          <path d="M40 0 C60 40 80 80 120 120 C100 130 80 110 50 90 C30 80 20 60 10 30 Z" />
          <path d="M70 10 C90 60 120 100 160 130 C140 140 110 120 80 90 C60 70 50 40 40 20 Z" opacity="0.7" />
          <path d="M0 60 C30 80 70 110 110 150 C90 160 60 140 40 120 C20 100 10 80 0 60 Z" opacity="0.5" />
        </svg>
      </div>

      <div className="absolute top-10 right-4 w-72 h-72 opacity-20 pointer-events-none text-brand-primary hidden md:block">
        <svg viewBox="0 0 200 200" fill="currentColor">
          <path d="M160 0 C140 40 120 80 80 120 C100 130 120 110 150 90 C170 80 180 60 190 30 Z" />
          <path d="M130 10 C110 60 80 100 40 130 C60 140 90 120 120 90 C140 70 150 40 160 20 Z" opacity="0.7" />
        </svg>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          <div className="lg:col-span-6 space-y-6 text-left">
            <h1 className="font-serif font-black text-4xl sm:text-5xl lg:text-6xl text-brand-text">
              Đi xa hơn,
              <br />
              <span className="text-brand-primary">chậm lại một chút.</span>
            </h1>

            <p className="text-slate-600 sm:text-lg  max-w-lg font-normal">
              Hành trình được chọn lọc để bạn khám phá thiên nhiên, văn hóa và nhịp sống bản địa.
            </p>

            <div className="pt-2 flex items-center gap-4">
              <Link
                href="/trips"
                className="inline-flex items-center gap-2.5 bg-brand-primary hover:bg-brand-dark text-white font-medium px-7 py-3.5 rounded-full shadow-lg shadow-teal-900/20 hover:shadow-teal-900/30 transition-all duration-300 group"
              >
                <span>Khám phá ngay</span> 
                <FaAngleDoubleRight />
              </Link>
            </div>
          </div>

          <div className="lg:col-span-6 relative flex items-center justify-center py-6">
            
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none z-0"
              viewBox="0 0 500 400"
              fill="none"
            >
              <path
                d="M 50 320 Q 220 120 450 80"
                stroke="var(--color-brand-primary)"
                strokeWidth="2"
                strokeDasharray="6 6"
                strokeOpacity="0.35"
              />
     
              <g transform="translate(380, 85) rotate(-15)">
                <FaPaperPlane aria-hidden="true" width="18" height="18" fill="var(--color-brand-primary)" opacity="0.8" />
              </g>
            </svg>


            <div className="relative w-full max-w-md h-[340px] sm:h-[380px] ">
             
              <div className="absolute left-2 sm:left-4 top-4 w-[240px] sm:w-[280px] h-[190px] sm:h-[220px] bg-white p-3 rounded-2xl shadow-2xl shadow-slate-900/15 -rotate-6 hover:rotate-0 hover:scale-105 transition-all duration-300 z-10 border border-slate-100">
                <div className="relative w-full h-full rounded-xl overflow-hidden bg-slate-100">
                  <Image
                    fill
                    sizes="280px"
                    src="/images/halong.jpg"
                    alt="Vịnh Hạ Long"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur-sm text-white text-[11px] px-2 py-0.5 rounded-md font-medium">
                    Vịnh Hạ Long
                  </div>
                </div>
              </div>

              <div className="absolute right-2 sm:right-4 bottom-4 w-[230px] sm:w-[270px] h-[180px] sm:h-[210px] bg-white p-3 rounded-2xl shadow-2xl shadow-slate-900/15 rotate-6 hover:rotate-0 hover:scale-105 transition-all duration-300 z-15 border border-slate-100">
                <div className="relative w-full h-full rounded-xl overflow-hidden bg-slate-100">
                  <Image
                    fill
                    sizes="280px"
                    src="/images/beach.jpg"
                    alt="Biển đảo Phú Quốc"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur-sm text-white text-[11px] px-2 py-0.5 rounded-md font-medium">
                    Phú Quốc
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
