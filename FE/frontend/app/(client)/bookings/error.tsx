"use client";

export default function Error({ retry }: { retry: () => void }) {
  return <div role="alert" className="mx-auto max-w-4xl px-4 py-10">
    <h1 className="text-2xl font-bold">Không thể tải lịch sử đặt vé</h1>
    <p className="mt-2 text-gray-500">Vui lòng thử lại sau ít phút.</p>
    <button onClick={retry} className="mt-4 rounded-lg bg-brand-primary px-5 py-2 font-semibold text-white hover:bg-brand-dark">Thử lại</button>
  </div>;
}
