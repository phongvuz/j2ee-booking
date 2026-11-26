import { FiSearch } from "react-icons/fi";
import type { TripSearchOption } from "@/types";

export default function SearchWidget({ options }: { options: TripSearchOption[] }) {
  const origins = [...new Set(options.map((option) => option.from))];
  const destinations = [...new Set(options.map((option) => option.to))];
  return (
    <div className="relative z-30 w-full max-w-5xl mx-auto px-4 -mt-10 lg:-mt-12">
      <form
        action="/trips"
        method="GET"
        className="bg-white rounded-3xl lg:rounded-full p-3 lg:p-3.5 shadow-2xl shadow-teal-950/10 border border-brand-border flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5 transition-all"
      >
        <div className="flex-1 flex items-center gap-3 px-4 py-2 rounded-2xl lg:rounded-full hover:bg-brand-bg transition-colors border border-transparent hover:border-brand-light">
          <div className="flex-1 min-w-0">
            <label htmlFor="from-select" className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Điểm đi
            </label>
            <select
              id="from-select"
              name="from"
              defaultValue=""
              className="w-full bg-transparent font-bold text-slate-800 text-sm focus:outline-none cursor-pointer py-0.5"
            >
              <option value="">Tất cả điểm đi</option>
              {origins.map((location) => (
                <option key={location} value={location}>{location}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="hidden lg:block w-px h-10 bg-slate-200" />

        <div className="flex-1 flex items-center gap-3 px-4 py-2 rounded-2xl lg:rounded-full hover:bg-brand-bg transition-colors border border-transparent hover:border-brand-light">
          <div className="flex-1 min-w-0">
            <label htmlFor="to-select" className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Điểm đến
            </label>
            <select
              id="to-select"
              name="to"
              defaultValue=""
              className="w-full bg-transparent font-bold text-slate-800 text-sm focus:outline-none cursor-pointer py-0.5"
            >
              <option value="">Tất cả điểm đến</option>
              {destinations.map((location) => (
                <option key={location} value={location}>{location}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="hidden lg:block w-px h-10 bg-slate-200" />

        <div className="flex-1 flex items-center gap-3 px-4 py-2 rounded-2xl lg:rounded-full hover:bg-brand-bg transition-colors border border-transparent hover:border-brand-light">
          <div className="flex-1 min-w-0">
            <label htmlFor="date-input" className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Ngày đi
            </label>
            <input
              id="date-input"
              type="date"
              name="date"
              className="w-full bg-transparent font-bold text-slate-800 text-sm focus:outline-none cursor-pointer py-0.5"
            />
          </div>
        </div>

        <button
          type="submit"
          className="bg-brand-primary hover:bg-brand-dark text-white font-semibold px-8 py-3.5 rounded-2xl lg:rounded-full flex items-center justify-center gap-2.5 shadow-lg shadow-teal-900/20 hover:shadow-teal-900/30 transition-all cursor-pointer group shrink-0"
        >
          <FiSearch aria-hidden="true" className="w-5 h-5 group-hover:scale-110 transition-transform" />
          <span className="text-sm font-bold">Tìm chuyến xe</span>
        </button>
      </form>
      <p className="mt-3 px-4 text-center text-xs text-slate-500">
        Để trống ngày đi để xem tất cả lịch chạy.
      </p>
    </div>
  );
}
