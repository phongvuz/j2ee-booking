export default function TripsLoading() {
  return (
    <div className="bg-gray-100 min-h-screen py-8 animate-pulse">
      <div className="max-w-7xl mx-auto px-4">

        <div className="bg-white rounded-lg p-6 mb-6 border border-gray-200 h-24"></div>

        <div className="flex flex-col md:flex-row gap-8">

          <aside className="w-full md:w-1/4">
            <div className="bg-white rounded-lg border border-gray-200 p-6 h-80"></div>
          </aside>

          <div className="w-full md:w-3/4 flex flex-col space-y-4">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="bg-white rounded-lg border border-gray-200 p-6 h-40"
              ></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
