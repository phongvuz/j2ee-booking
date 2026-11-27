import { FiSearch } from "react-icons/fi";
import Link from "next/link";

export default function TripNotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-3xl mb-4">
        <FiSearch aria-hidden="true" className="inline-block shrink-0 align-middle" />
      </div>
      <h2 className="text-2xl font-bold text-gray-800 mb-2">Không tìm thấy chuyến xe</h2>
      <p className="text-gray-600 mb-6 max-w-md text-sm">
        Mã chuyến xe bạn yêu cầu không tồn tại, đã hết hạn hoặc đã hoàn tất hành trình.
      </p>
      <Link
        href="/trips"
        className="bg-brand-primary hover:bg-brand-dark text-white font-semibold py-2.5 px-6 rounded-md transition-colors"
      >
        Xem danh sách chuyến khác
      </Link>
    </div>
  );
}
