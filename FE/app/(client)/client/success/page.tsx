import Link from "next/link";

interface SearchParams {
  tripId: string;
  seats: string;
}

export default async function SuccessPage({searchParams,}: {searchParams: Promise<SearchParams>;}) {
  const params = await searchParams;

  return (
    <div className="bg-gray-100 min-h-screen py-16 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl">✅</span>
        </div>
        
        <h2 className="text-3xl font-bold text-gray-800 mb-4">Đặt vé thành công!</h2>
        <p className="text-gray-600 mb-8">
          Cảm ơn bạn đã tin tưởng và lựa chọn Nhà xe Sài Gòn. Chuyến đi của bạn đã được xác nhận.
        </p>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-8 text-left">
          <h3 className="font-bold text-lg mb-4 border-b pb-2">Thông tin vé</h3>
          <div className="space-y-3 text-gray-700">
            <div className="flex justify-between">
              <span>Mã chuyến xe:</span>
              <span className="font-bold">{params.tripId || "VN01"}</span>
            </div>
            <div className="flex justify-between">
              <span>Ghế đã đặt:</span>
              <span className="font-bold">{params.seats || "Chưa xác định"}</span>
            </div>
            <div className="flex justify-between">
              <span>Mã đặt chỗ (PNR):</span>
              <span className="font-bold text-blue-600">NHAXE-{Math.random().toString(36).substring(2, 8).toUpperCase()}</span>
            </div>
          </div>
        </div>

        <p className="text-sm text-gray-500 mb-8">
          Chúng tôi đã gửi email xác nhận cùng vé điện tử. Vui lòng xuất trình mã đặt chỗ khi ra bến xe.
        </p>

        <Link 
          href="/" 
          className="inline-block bg-[#ef5222] hover:bg-[#d94a1d] text-white font-bold py-3 px-8 rounded-md transition-colors"
        >
          Trở về trang chủ
        </Link>
      </div>
    </div>
  );
}
