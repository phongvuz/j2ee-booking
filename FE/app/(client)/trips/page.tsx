import { tripsDatabase } from "../../lib/db";
import Link from "next/link";

interface SearchParams {
  from: string;
  to: string;
  date: string;
}

export default async function TripsPage({searchParams,}: {searchParams: Promise<SearchParams>;}) {
    const params = await searchParams;
    const trips = tripsDatabase;

  return (
    <div className="bg-gray-100 min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4">
        
        {/* Search Summary Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6 flex flex-col md:flex-row md:items-center justify-between border border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Kết quả tìm kiếm</h2>
            <p className="text-gray-600">
              Tuyến: <span className="font-bold text-[#ef5222]">{params.from || "SGN"}</span> ➔ <span className="font-bold text-[#ef5222]">{params.to || "DLT"}</span> 
              <span className="mx-2">|</span>
              Ngày đi: <span className="font-bold">{params.date || "15/09/2026"}</span>
            </p>
          </div>
          <Link href="/" className="mt-4 md:mt-0 text-blue-600 font-medium hover:underline">
            Thay đổi tìm kiếm
          </Link>
        </div>

        <div className="flex flex-col md:flex-row gap-8">
          
          {/* Sidebar Filters */}
          <aside className="w-full md:w-1/4">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-24">
              <h3 className="font-bold text-lg mb-4 border-b pb-2">Bộ lọc tìm kiếm</h3>
              
              <div className="mb-6">
                <h4 className="font-semibold mb-3 text-sm text-gray-700">Giờ đi</h4>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded text-[#ef5222] focus:ring-[#ef5222]" /> Sáng sớm (00:00 - 06:00)
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded text-[#ef5222] focus:ring-[#ef5222]" /> Sáng (06:00 - 12:00)
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded text-[#ef5222] focus:ring-[#ef5222]" /> Chiều (12:00 - 18:00)
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded text-[#ef5222] focus:ring-[#ef5222]" /> Tối (18:00 - 24:00)
                  </label>
                </div>
              </div>

              <div className="mb-6">
                <h4 className="font-semibold mb-3 text-sm text-gray-700">Loại xe</h4>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded text-[#ef5222] focus:ring-[#ef5222]" /> Giường nằm
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded text-[#ef5222] focus:ring-[#ef5222]" /> Limousine
                  </label>
                </div>
              </div>

            </div>
          </aside>

          {/* Results List */}
          <div className="w-full md:w-3/4 flex flex-col space-y-4">
            {trips.length > 0 ? trips.map((trip) => (
              <div key={trip.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col md:flex-row justify-between hover:shadow-md transition-shadow">
                
                {/* Trip Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-800">{trip.time.split(' - ')[0]}</p>
                      <p className="text-sm text-gray-500">Bến đi</p>
                    </div>
                    <div className="flex-1 flex items-center justify-center relative px-4">
                      <div className="w-full h-[2px] bg-gray-200 absolute"></div>
                      <span className="bg-white px-2 text-xs text-gray-500 relative z-10 border border-gray-200 rounded-full">7 giờ</span>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-800">{trip.time.split(' - ')[1]}</p>
                      <p className="text-sm text-gray-500">Bến đến</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <span className="bg-gray-100 px-2 py-1 rounded font-medium text-gray-800">{trip.type}</span>
                    <span className="flex items-center gap-1 text-green-600 font-medium">
                      <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
                      Còn {trip.emptySeats} chỗ trống
                    </span>
                  </div>
                </div>

                {/* Price & Action */}
                <div className="mt-6 md:mt-0 md:ml-8 flex flex-col items-start md:items-end justify-center md:border-l md:border-gray-100 md:pl-8">
                  <p className="text-2xl font-extrabold text-[#ef5222] mb-3">{trip.price}</p>
                  <Link 
                    href={`/trips/${trip.id}`} 
                    className="bg-[#ef5222] hover:bg-[#d94a1d] text-white font-bold py-2 px-6 rounded-md transition-colors text-center w-full md:w-auto"
                  >
                    Chọn chuyến
                  </Link>
                </div>
              </div>
            )) : (
              <div className="bg-white rounded-lg shadow-sm p-8 text-center border border-gray-200">
                <p className="text-gray-500 text-lg">Không tìm thấy chuyến xe nào phù hợp với tìm kiếm của bạn.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}