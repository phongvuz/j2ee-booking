export default function AdminBusesPage() {
  const buses = [
    { id: "BUS-001", plate: "51B-123.45", type: "Limousine 22 phòng", seats: 22, status: "Đang hoạt động" },
    { id: "BUS-002", plate: "51B-987.65", type: "Giường nằm 34 chỗ", seats: 34, status: "Đang hoạt động" },
    { id: "BUS-003", plate: "51B-456.78", type: "Giường nằm 34 chỗ", seats: 34, status: "Bảo dưỡng" },
    { id: "BUS-004", plate: "51B-333.33", type: "Limousine 22 phòng", seats: 22, status: "Đang hoạt động" },
    { id: "BUS-005", plate: "49B-111.11", type: "Giường nằm 34 chỗ", seats: 34, status: "Ngừng hoạt động" },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Quản lý Xe</h1>
        <button className="bg-[#ef5222] hover:bg-[#d94a1d] text-white px-4 py-2 rounded-md font-medium transition-colors">
          + Thêm xe mới
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex gap-4">
          <input 
            type="text" 
            placeholder="Tìm kiếm theo biển số..." 
            className="border border-gray-300 rounded px-3 py-2 w-64 focus:outline-none focus:border-[#ef5222]"
          />
          <select className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:border-[#ef5222]">
            <option value="">Tất cả trạng thái</option>
            <option value="active">Đang hoạt động</option>
            <option value="maintenance">Bảo dưỡng</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 font-semibold">Mã Xe</th>
                <th className="px-6 py-3 font-semibold">Biển số</th>
                <th className="px-6 py-3 font-semibold">Loại xe</th>
                <th className="px-6 py-3 font-semibold">Số chỗ</th>
                <th className="px-6 py-3 font-semibold">Trạng thái</th>
                <th className="px-6 py-3 font-semibold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {buses.map((bus) => (
                <tr key={bus.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{bus.id}</td>
                  <td className="px-6 py-4 font-bold">{bus.plate}</td>
                  <td className="px-6 py-4">{bus.type}</td>
                  <td className="px-6 py-4">{bus.seats}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      bus.status === 'Đang hoạt động' ? 'bg-green-100 text-green-700' : 
                      bus.status === 'Bảo dưỡng' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {bus.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-blue-600 hover:underline mr-3">Sửa</button>
                    <button className="text-red-600 hover:underline">Xóa</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="p-4 border-t border-gray-200 text-sm text-gray-500 text-center">
          Hiển thị {buses.length} trên tổng số {buses.length} xe
        </div>
      </div>
    </div>
  );
}
