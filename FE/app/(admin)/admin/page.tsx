export default function AdminDashboard() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Bảng điều khiển</h1>
      
      {/* Thống kê chung */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <p className="text-sm font-medium text-gray-500 mb-1">Tổng doanh thu (Tháng này)</p>
          <p className="text-2xl font-bold text-gray-900">425.500.000 đ</p>
          <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
            <span>↑ 12%</span> so với tháng trước
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <p className="text-sm font-medium text-gray-500 mb-1">Vé đã bán (Hôm nay)</p>
          <p className="text-2xl font-bold text-gray-900">156</p>
          <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
            <span>↑ 5%</span> so với hôm qua
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <p className="text-sm font-medium text-gray-500 mb-1">Xe đang hoạt động</p>
          <p className="text-2xl font-bold text-gray-900">24 / 30</p>
          <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
            6 xe đang bảo dưỡng/nghỉ
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <p className="text-sm font-medium text-gray-500 mb-1">Nhân sự (Đang làm)</p>
          <p className="text-2xl font-bold text-gray-900">45</p>
          <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
            Tài xế, Phụ xe, Văn phòng
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Đơn hàng mới nhất */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 lg:col-span-2">
          <h3 className="font-bold text-gray-800 mb-4 pb-2 border-b">Đơn hàng vé mới nhất</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-gray-500 bg-gray-50">
                <tr>
                  <th className="px-4 py-2 font-medium rounded-tl-md">Mã vé</th>
                  <th className="px-4 py-2 font-medium">Khách hàng</th>
                  <th className="px-4 py-2 font-medium">Tuyến</th>
                  <th className="px-4 py-2 font-medium">Tổng tiền</th>
                  <th className="px-4 py-2 font-medium rounded-tr-md">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="px-4 py-3 font-medium">NHAXE-1A2B3C</td>
                  <td className="px-4 py-3">Nguyễn Văn A</td>
                  <td className="px-4 py-3">SGN - DLT</td>
                  <td className="px-4 py-3 text-[#ef5222] font-medium">500.000 đ</td>
                  <td className="px-4 py-3"><span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">Đã thanh toán</span></td>
                </tr>
                <tr className="border-b">
                  <td className="px-4 py-3 font-medium">NHAXE-X9Y8Z7</td>
                  <td className="px-4 py-3">Trần Thị B</td>
                  <td className="px-4 py-3">SGN - NHA</td>
                  <td className="px-4 py-3 text-[#ef5222] font-medium">300.000 đ</td>
                  <td className="px-4 py-3"><span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs">Chờ thanh toán</span></td>
                </tr>
                <tr className="border-b">
                  <td className="px-4 py-3 font-medium">NHAXE-M1N2P3</td>
                  <td className="px-4 py-3">Lê Hoàng C</td>
                  <td className="px-4 py-3">DLT - SGN</td>
                  <td className="px-4 py-3 text-[#ef5222] font-medium">250.000 đ</td>
                  <td className="px-4 py-3"><span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">Đã thanh toán</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Thông báo hệ thống */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="font-bold text-gray-800 mb-4 pb-2 border-b">Thông báo hệ thống</h3>
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="w-2 h-2 mt-1.5 rounded-full bg-red-500 shrink-0"></div>
              <div>
                <p className="text-sm font-medium text-gray-800">Xe 51B-123.45 cần bảo dưỡng</p>
                <p className="text-xs text-gray-500">Đã đạt 10,000km từ lần bảo dưỡng trước.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-2 h-2 mt-1.5 rounded-full bg-green-500 shrink-0"></div>
              <div>
                <p className="text-sm font-medium text-gray-800">Cập nhật hệ thống thành công</p>
                <p className="text-xs text-gray-500">Bản vá bảo mật đã được cài đặt lúc 02:00 AM.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-2 h-2 mt-1.5 rounded-full bg-yellow-500 shrink-0"></div>
              <div>
                <p className="text-sm font-medium text-gray-800">Tài xế Nguyễn Văn D xin nghỉ phép</p>
                <p className="text-xs text-gray-500">Xin nghỉ từ ngày 16/09 đến 18/09.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
