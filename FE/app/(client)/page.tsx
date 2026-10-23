import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="bg-slate-800 text-white py-20 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&q=80')] bg-cover bg-center"></div>
        <div className="max-w-7xl mx-auto px-4 relative z-10 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">Hành trình thoải mái, kết nối mọi miền</h1>
          <p className="text-lg md:text-xl text-slate-300 mb-10 max-w-2xl mx-auto">
            Đặt vé xe trực tuyến dễ dàng, nhanh chóng và an toàn. Trải nghiệm dịch vụ xe khách chất lượng cao hàng đầu Việt Nam.
          </p>
          
          {/* Booking Form */}
          <div className="bg-white text-gray-800 rounded-lg p-6 md:p-8 shadow-xl max-w-4xl mx-auto text-left">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <span className="text-[#ef5222]">🎫</span> Tìm chuyến xe của bạn
            </h3>
            <form action="/trips" className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="flex flex-col">
                <label className="text-sm font-semibold text-gray-700 mb-2">Điểm đi</label>
                <select name="from" className="border border-gray-300 rounded-md p-3 bg-gray-50 focus:border-[#ef5222] focus:outline-none transition-colors">
                  <option value="SGN">Hồ Chí Minh</option>
                  <option value="DLT">Đà Lạt</option>
                  <option value="NHA">Nha Trang</option>
                  <option value="HAN">Hà Nội</option>
                  <option value="DAD">Đà Nẵng</option>
                </select>
              </div>

              <div className="flex flex-col">
                <label className="text-sm font-semibold text-gray-700 mb-2">Điểm đến</label>
                <select name="to" className="border border-gray-300 rounded-md p-3 bg-gray-50 focus:border-[#ef5222] focus:outline-none transition-colors">
                  <option value="DLT">Đà Lạt</option>
                  <option value="SGN">Hồ Chí Minh</option>
                  <option value="NHA">Nha Trang</option>
                  <option value="HAN">Hà Nội</option>
                  <option value="DAD">Đà Nẵng</option>
                </select>
              </div>

              <div className="flex flex-col">
                <label className="text-sm font-semibold text-gray-700 mb-2">Ngày đi</label>
                <input type="date" name="date" className="border border-gray-300 rounded-md p-3 bg-gray-50 focus:border-[#ef5222] focus:outline-none transition-colors" />
              </div>

              <button type="submit" className="bg-[#ef5222] hover:bg-[#d94a1d] text-white font-bold py-3 px-4 rounded-md transition-colors w-full h-[50px]">
                Tìm Chuyến Xe
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Popular Routes Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12 text-gray-800">Các Tuyến Đường Phổ Biến</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Route 1 */}
            <div className="bg-white rounded-lg overflow-hidden shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              <div className="h-48 bg-gray-300 relative">
                <img src="/images/dalat.jpg" alt="Đà Lạt" className="w-full h-full object-cover" />
              </div>
              <div className="p-6">
                <h3 className="font-bold text-xl mb-2">Sài Gòn ➔ Đà Lạt</h3>
                <p className="text-gray-600 mb-4 text-sm">Khoảng 300km - 7 tiếng di chuyển</p>
                <div className="flex justify-between items-center border-t border-gray-100 pt-4">
                  <span className="text-lg font-bold text-[#ef5222]">Từ 250.000đ</span>
                  <Link href="/trips?from=SGN&to=DLT" className="text-blue-600 font-medium hover:underline text-sm">
                    Xem lịch trình
                  </Link>
                </div>
              </div>
            </div>

            {/* Route 2 */}
            <div className="bg-white rounded-lg overflow-hidden shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              <div className="h-48 bg-gray-300 relative">
                <img src="/images/nhatrang.jpg" alt="Nha Trang" className="w-full h-full object-cover" />
              </div>
              <div className="p-6">
                <h3 className="font-bold text-xl mb-2">Sài Gòn ➔ Nha Trang</h3>
                <p className="text-gray-600 mb-4 text-sm">Khoảng 430km - 9 tiếng di chuyển</p>
                <div className="flex justify-between items-center border-t border-gray-100 pt-4">
                  <span className="text-lg font-bold text-[#ef5222]">Từ 300.000đ</span>
                  <Link href="/trips?from=SGN&to=NHA" className="text-blue-600 font-medium hover:underline text-sm">
                    Xem lịch trình
                  </Link>
                </div>
              </div>
            </div>

            {/* Route 3 */}
            <div className="bg-white rounded-lg overflow-hidden shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              <div className="h-48 bg-gray-300 relative">
                <img src="/images/hanoi.jpg" alt="Hà Nội" className="w-full h-full object-cover" />
              </div>
              <div className="p-6">
                <h3 className="font-bold text-xl mb-2">Sài Gòn ➔ Hà Nội</h3>
                <p className="text-gray-600 mb-4 text-sm">Khoảng 170km - 3.5 tiếng di chuyển</p>
                <div className="flex justify-between items-center border-t border-gray-100 pt-4">
                  <span className="text-lg font-bold text-[#ef5222]">Từ 165.000đ</span>
                  <Link href="/trips?from=SGN&to=CTH" className="text-blue-600 font-medium hover:underline text-sm">
                    Xem lịch trình
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-16 text-gray-800">Tại sao chọn chúng tôi?</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center">
            <div className="p-4">
              <div className="text-4xl mb-4">🛡️</div>
              <h4 className="font-bold text-lg mb-2">An toàn tuyệt đối</h4>
              <p className="text-gray-600 text-sm">Đội ngũ lái xe giàu kinh nghiệm, xe được bảo dưỡng định kỳ.</p>
            </div>
            <div className="p-4">
              <div className="text-4xl mb-4">💺</div>
              <h4 className="font-bold text-lg mb-2">Tiện nghi cao cấp</h4>
              <p className="text-gray-600 text-sm">Giường nằm rộng rãi, massage, wifi tốc độ cao miễn phí.</p>
            </div>
            <div className="p-4">
              <div className="text-4xl mb-4">⚡</div>
              <h4 className="font-bold text-lg mb-2">Đặt vé nhanh chóng</h4>
              <p className="text-gray-600 text-sm">Hệ thống đặt vé trực tuyến hoạt động 24/7, xác nhận tức thì.</p>
            </div>
            <div className="p-4">
              <div className="text-4xl mb-4">🎁</div>
              <h4 className="font-bold text-lg mb-2">Nhiều ưu đãi</h4>
              <p className="text-gray-600 text-sm">Thường xuyên có chương trình khuyến mãi cho khách hàng thân thiết.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}