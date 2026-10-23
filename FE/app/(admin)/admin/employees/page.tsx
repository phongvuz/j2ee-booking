export default function AdminEmployeesPage() {
  const employees = [
    { id: "EMP-001", name: "Nguyễn Văn A", role: "Tài xế", phone: "0901234567", status: "Đang làm việc" },
    { id: "EMP-002", name: "Trần Thị B", role: "Văn phòng", phone: "0912345678", status: "Đang làm việc" },
    { id: "EMP-003", name: "Lê Hoàng C", role: "Phụ xe", phone: "0923456789", status: "Nghỉ phép" },
    { id: "EMP-004", name: "Phạm Văn D", role: "Tài xế", phone: "0934567890", status: "Đang làm việc" },
    { id: "EMP-005", name: "Hoàng Thị E", role: "Quản lý", phone: "0945678901", status: "Đang làm việc" },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Quản lý Nhân viên</h1>
        <button className="bg-[#ef5222] hover:bg-[#d94a1d] text-white px-4 py-2 rounded-md font-medium transition-colors">
          + Thêm nhân viên
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex gap-4">
          <input 
            type="text" 
            placeholder="Tìm kiếm tên, SĐT..." 
            className="border border-gray-300 rounded px-3 py-2 w-64 focus:outline-none focus:border-[#ef5222]"
          />
          <select className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:border-[#ef5222]">
            <option value="">Tất cả phòng ban/vai trò</option>
            <option value="driver">Tài xế</option>
            <option value="assistant">Phụ xe</option>
            <option value="office">Văn phòng</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 font-semibold">Mã NV</th>
                <th className="px-6 py-3 font-semibold">Họ và Tên</th>
                <th className="px-6 py-3 font-semibold">Vai trò</th>
                <th className="px-6 py-3 font-semibold">Số điện thoại</th>
                <th className="px-6 py-3 font-semibold">Trạng thái</th>
                <th className="px-6 py-3 font-semibold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{emp.id}</td>
                  <td className="px-6 py-4 font-bold">{emp.name}</td>
                  <td className="px-6 py-4">{emp.role}</td>
                  <td className="px-6 py-4">{emp.phone}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      emp.status === 'Đang làm việc' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {emp.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-blue-600 hover:underline mr-3">Sửa</button>
                    <button className="text-red-600 hover:underline">Nghỉ việc</button>
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
