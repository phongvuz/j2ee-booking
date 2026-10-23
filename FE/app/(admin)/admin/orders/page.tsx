export default function AdminOrdersPage() {
  const orders = [
    { id: "NHAXE-1A2B3C", customer: "Nguyễn Văn A", phone: "0901112223", route: "SGN - DLT", seats: "1A1, 1A2", total: "500.000 đ", status: "Đã thanh toán", date: "15/09/2026" },
    { id: "NHAXE-X9Y8Z7", customer: "Trần Thị B", phone: "0912223334", route: "SGN - NHA", seats: "2B3", total: "300.000 đ", status: "Chờ thanh toán", date: "15/09/2026" },
    { id: "NHAXE-M1N2P3", customer: "Lê Hoàng C", phone: "0923334445", route: "DLT - SGN", seats: "1C5", total: "250.000 đ", status: "Đã thanh toán", date: "16/09/2026" },
    { id: "NHAXE-Q7W8E9", customer: "Phạm Văn D", phone: "0934445556", route: "SGN - CTH", seats: "1A3, 1B3", total: "330.000 đ", status: "Đã hủy", date: "16/09/2026" },
    { id: "NHAXE-J5K6L7", customer: "Hoàng Thị E", phone: "0945556667", route: "NHA - SGN", seats: "2A1, 2A2, 2A3", total: "900.000 đ", status: "Đã thanh toán", date: "17/09/2026" },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Quản lý Đơn hàng / Vé</h1>
        <button className="bg-[#ef5222] hover:bg-[#d94a1d] text-white px-4 py-2 rounded-md font-medium transition-colors">
          + Tạo đơn vé mới (Offine)
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex flex-wrap gap-4">
          <input 
            type="text" 
            placeholder="Tìm kiếm mã vé, tên KH, SĐT..." 
            className="border border-gray-300 rounded px-3 py-2 w-full md:w-64 focus:outline-none focus:border-[#ef5222]"
          />
          <input 
            type="date" 
            className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:border-[#ef5222]"
          />
          <select className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:border-[#ef5222]">
            <option value="">Tất cả trạng thái</option>
            <option value="paid">Đã thanh toán</option>
            <option value="pending">Chờ thanh toán</option>
            <option value="cancelled">Đã hủy</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 font-semibold">Mã PNR</th>
                <th className="px-6 py-3 font-semibold">Khách hàng</th>
                <th className="px-6 py-3 font-semibold">Tuyến & Ngày đi</th>
                <th className="px-6 py-3 font-semibold">Ghế</th>
                <th className="px-6 py-3 font-semibold">Tổng tiền</th>
                <th className="px-6 py-3 font-semibold">Trạng thái</th>
                <th className="px-6 py-3 font-semibold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-6 py-4 font-bold text-[#ef5222]">{order.id}</td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900">{order.customer}</p>
                    <p className="text-xs text-gray-500">{order.phone}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-medium">{order.route}</p>
                    <p className="text-xs text-gray-500">{order.date}</p>
                  </td>
                  <td className="px-6 py-4">{order.seats}</td>
                  <td className="px-6 py-4 font-bold">{order.total}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      order.status === 'Đã thanh toán' ? 'bg-green-100 text-green-700' : 
                      order.status === 'Chờ thanh toán' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-blue-600 hover:underline mr-3">Chi tiết</button>
                    {order.status !== 'Đã hủy' && (
                      <button className="text-red-600 hover:underline">Hủy</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
