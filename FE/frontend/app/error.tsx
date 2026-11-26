"use client";

import { useEffect } from "react";
import Link from "next/link";
import { BiError } from "react-icons/bi";
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application Error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-4xl mb-6 shadow-sm">
        <BiError />
      </div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Đã có lỗi xảy ra!</h1>
      <p className="text-gray-600 max-w-md mb-8 text-sm">
        Hệ thống gặp sự cố không mong muốn trong khi tải nội dung. Bạn có thể thử tải lại trang hoặc quay về trang chủ.
      </p>
      <div className="flex gap-4">
        <button
          onClick={() => reset()}
          className="bg-brand-primary hover:bg-brand-dark text-white font-semibold py-2.5 px-6 rounded-lg transition-colors cursor-pointer"
        >
          Thử Lại
        </button>
        <Link
          href="/"
          className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold py-2.5 px-6 rounded-lg transition-colors"
        >
          Về Trang Chủ
        </Link>
      </div>
    </div>
  );
}
