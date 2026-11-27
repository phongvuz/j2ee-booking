import { FaPaperPlane } from "react-icons/fa";
import { FiCamera, FiMapPin, FiNavigation, FiShield } from "react-icons/fi";

export default function TravelRoadmap() {
  const steps = [
    {
      title: "Lên kế hoạch",
      desc: "Lựa chọn tuyến đường, giờ chạy và vị trí ghế yêu thích",
      icon: (
        <FiNavigation aria-hidden="true" className="w-6 h-6 text-brand-primary" />
      ),
    },
    {
      title: "An toàn",
      desc: "Bảo hiểm hành khách trọn vẹn & xe đời mới bảo dưỡng nghiêm ngặt",
      icon: (
        <FiShield aria-hidden="true" className="w-6 h-6 text-brand-primary" />
      ),
    },
    {
      title: "Trải nghiệm",
      desc: "Tận hưởng không gian tiện nghi, wifi, nước uống và cảnh đẹp",
      icon: (
        <FiMapPin aria-hidden="true" className="w-6 h-6 text-brand-primary" />
      ),
    },
    {
      title: "Lưu kỷ niệm",
      desc: "Lưu lại những khoảnh khắc tuyệt vời và kết nối những miền đất mới",
      icon: (
        <FiCamera aria-hidden="true" className="w-6 h-6 text-brand-primary" />
      ),
    },
  ];

  return (
    <section className="relative py-20 overflow-hidden bg-gradient-to-b from-brand-bg via-[#EBF5F1] to-[#E3EFEA]">
      {/* Botanical Palm Fronds Decorative (Bottom Left) */}
      <div className="absolute -bottom-10 -left-10 w-72 h-72 opacity-25 pointer-events-none text-brand-primary">
        <svg viewBox="0 0 200 200" fill="currentColor">
          <path d="M40 200 C60 160 80 120 120 80 C100 70 80 90 50 110 C30 120 20 140 10 170 Z" />
          <path d="M70 190 C90 140 120 100 160 70 C140 60 110 80 80 110 C60 130 50 160 40 180 Z" opacity="0.7" />
        </svg>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="relative">
          {/* Curved Dotted Connecting Line (Desktop) */}
          <div className="hidden lg:block absolute top-9 left-16 right-16 z-0 pointer-events-none">
            <svg
              className="w-full h-16"
              viewBox="0 0 900 60"
              fill="none"
              preserveAspectRatio="none"
            >
              <path
                d="M 10 30 Q 225 5 450 30 T 880 30"
                stroke="var(--color-brand-primary)"
                strokeWidth="2.5"
                strokeDasharray="6 7"
                strokeOpacity="0.45"
              />
              {/* Flight plane icon on trajectory */}
              <g transform="translate(860, 22) rotate(10)">
                <FaPaperPlane aria-hidden="true" width="18" height="18" fill="var(--color-brand-primary)" />
              </g>
            </svg>
          </div>

          {/* 4 Steps Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-6 relative z-10">
            {steps.map((step, idx) => (
              <div
                key={idx}
                className="flex flex-col items-center text-center group"
              >
                {/* Outer Ring & Circle Badge */}
                <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-full bg-white border-2 border-[#D3E8E1] group-hover:border-brand-primary flex items-center justify-center shadow-lg shadow-teal-900/10 group-hover:scale-110 group-hover:shadow-teal-900/20 transition-all duration-300 relative">
                  <div className="w-13 h-13 sm:w-15 sm:h-15 rounded-full bg-[#EBF5F1] group-hover:bg-[#E1EFEA] flex items-center justify-center transition-colors">
                    {step.icon}
                  </div>
                </div>

                {/* Title */}
                <h3 className="font-bold text-base sm:text-lg text-brand-text mt-4 mb-1 group-hover:text-brand-primary transition-colors">
                  {step.title}
                </h3>

                {/* Subtitle description */}
                <p className="text-xs text-slate-500 max-w-[200px] leading-relaxed hidden sm:block">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
