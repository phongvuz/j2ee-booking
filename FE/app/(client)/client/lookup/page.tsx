
export default function Lookup() {
  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">TRA CỨU THÔNG TIN VÉ</h2>
        <p className="text-gray-500">Nhập số điện thoại hoặc mã vé để kiểm tra lịch trình chuyến đi của bạn</p>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100">
        <div className="flex flex-col md:flex-row gap-3">
          <input 
            type="text" 
            placeholder="Nhập số điện thoại hoặc mã vé (VD: TICKET_01)" 
            className="flex-1 border border-gray-300 rounded-xl p-3.5 focus:outline-none focus:border-[#ef5222] text-gray-700 bg-gray-50"
          />
          <button 
            type="button" 
            className="bg-[#ef5222] hover:bg-orange-600 text-white font-bold px-8 py-3.5 rounded-xl transition shadow-sm"
          >
            Tra cứu
          </button>
        </div>
      </div>


      <div className="mt-8 space-y-4 hidden">
        <h3 className="font-bold text-gray-700 text-lg">Kết quả tra cứu (Ví dụ giao diện):</h3>
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border-2 border-orange-200">
          <div className="flex justify-between items-center border-b pb-3 mb-4">
            <span className="font-bold text-[#ef5222] text-lg">Mã vé: TICKET_ABC123</span>
            <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1.5 rounded-full">
              Thành công
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-4">
            <div>
              <p className="text-gray-400">Họ tên khách hàng</p>
              <p className="font-bold text-gray-800 text-base">Nguyễn Văn A</p>
            </div>
            <div>
              <p className="text-gray-400">Số điện thoại</p>
              <p className="font-bold text-gray-800 text-base">0909123456</p>
            </div>
            <div>
              <p className="text-gray-400">Mã chuyến xe</p>
              <p className="font-bold text-blue-600 text-base">VN01 (Sài Gòn ➔ Đà Lạt)</p>
            </div>
            <div>
              <p className="text-gray-400">Ghế đã chọn</p>
              <p className="font-bold text-blue-600 text-base">A1, A2</p>
            </div>
          </div>

          <div className="pt-3 border-t flex justify-between items-center">
            <span className="text-sm text-gray-400">Ngày đặt: 16/09/2026</span>
            <span className="text-xl font-bold text-[#ef5222]">600.000đ</span>
          </div>
        </div>
      </div>
    </div>
  );
}