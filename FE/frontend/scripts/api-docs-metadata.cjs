// Reviewed descriptions complement routes and Zod; the generator checks route coverage.
// Unknown service response data deliberately remains unconstrained in OpenAPI.
const string = (description, extra = {}) => ({ type: "string", description, ...extra });
const integer = (description, extra = {}) => ({ type: "integer", description, ...extra });
const query = (name, schema, required = false) => ({ name, in: "query", required, description: schema.description, schema });
const q = (name, description, extra) => query(name, string(description, extra));
const page = query("page", integer("Trang, mặc định 1; giá trị không hợp lệ được chuẩn hóa.", { minimum: 1 }));
const limit = query("limit", integer("Số bản ghi mỗi trang, mặc định 10; giới hạn do service áp dụng.", { minimum: 1 }));
const sortOrder = q("sortOrder", "Chiều sắp xếp.", { enum: ["asc", "desc"] });
const list = (filters, sorts) => [q("search", "Từ khóa tìm kiếm."), ...filters.map((n) => q(n, `Lọc theo ${n}.`)), page, limit, q("sortBy", "Cột sắp xếp.", { enum: sorts }), sortOrder];
const pnr = query("pnr", string("Mã đặt chỗ được trả sau khi tạo vé.", { minLength: 1, maxLength: 191 }), true);
const clientId = q("clientId", "Mã riêng của tab; không phải thông tin xác thực. Cookie seat_session được tạo bởi holds/stream.", { minLength: 1, maxLength: 80, pattern: "^[a-zA-Z0-9_-]+$" });
const metadata = {};
const op = (method, path, summary, config = {}) => { metadata[`${method} ${path}`] = { summary, auth: "public", errors: [], ...config }; };
const bookingExample = { tripId: 1, seats: ["A01"], fullName: "Nguyễn Văn An", phone: "0901234567" };

op("POST", "/api/auth/login", "Đăng nhập khách hàng hoặc quản trị viên", {
  request: "LoginInput", example: { identifier: "an@example.com", password: "example-password", audience: "customer" },
  response: "LoginResult", errors: [400, 401, 403, 500],
  description: "Email hoặc số điện thoại trong identifier. Trả cookie HttpOnly riêng: admin_session cho ADMIN, customer_session cho CUSTOMER; audience giới hạn loại tài khoản được đăng nhập. Hai phiên tồn tại độc lập trong cùng trình duyệt. Bản demo thêm tiền tố demo_ vào tên cookie.",
});
op("POST", "/api/auth/register", "Đăng ký tài khoản khách hàng", {
  request: "RegisterInput", status: 201, response: "RegistrationResult", errors: [400, 403, 409, 500],
  example: { fullName: "Nguyễn Văn An", email: "an@example.com", phone: "0901234567", password: "example-password", confirmPassword: "example-password", agreeTerms: true },
  description: "Mật khẩu xác nhận phải trùng; tài khoản thành công nhận cookie customer_session. Không gửi mật khẩu thật vào tài liệu.",
});
op("POST", "/api/auth/logout", "Đăng xuất và xóa cookie phiên", {
  response: "Success", errors: [400, 403],
  queries: [q("audience", "Loại phiên cần đăng xuất, mặc định customer; không xóa phiên của loại tài khoản còn lại.", { enum: ["customer", "admin"], default: "customer" })],
});
op("GET", "/api/auth/session", "Kiểm tra phiên đăng nhập hiện tại", { response: "SessionResult", errors: [500], description: "Không yêu cầu đăng nhập; trả authenticated=false và user=null khi không có phiên hợp lệ. Nếu có cả hai phiên, ưu tiên CUSTOMER. Chỉ đọc trạng thái, không đặt hoặc xóa cookie để tránh phản hồi đến muộn xóa phiên mới." });
op("PATCH", "/api/customer/profile", "Cập nhật hồ sơ hoặc đổi mật khẩu", {
  auth: "customer", request: "CustomerUpdateInput", response: "MessageResult", errors: [400, 401, 403, 409, 500],
  example: { action: "profile", fullName: "Nguyễn Văn An", email: "an@example.com", phone: "0901234567", address: "TP. Hồ Chí Minh" },
  description: "action=profile cập nhật thông tin; action=password yêu cầu currentPassword, password và confirmPassword. Mật khẩu mới phải khác hiện tại và khớp xác nhận. Đổi mật khẩu thành công cấp lại cookie phiên.",
});
op("GET", "/api/bookings", "Tra cứu vé theo PNR và số điện thoại hành khách", {
  queries: [pnr, query("phone", string("Số điện thoại hành khách khớp lượt đặt.", { pattern: "^(?:0|\\+84)[0-9]{9}$" }), true)],
  response: "LookupResult", errors: [400, 429, 500],
  description: "Yêu cầu đồng thời PNR và phone. Không có cơ chế liệt kê công khai toàn bộ vé. HTTP 429 có Retry-After khi vượt giới hạn tra cứu.",
});
op("POST", "/api/bookings", "Tạo lượt đặt vé online chờ thanh toán", {
  request: "OnlineBookingInput", example: bookingExample, response: "BookingCreated", status: 201, errors: [400, 403, 404, 409, 500],
  description: "Cho phép khách vãng lai; phiên khách hàng hợp lệ liên kết vé với tài khoản. seats là mảng mã ghế, không dùng seatNumber riêng lẻ. Server tự tính giá và tạo vé PENDING; không nhận giá/trạng thái thanh toán từ client. Nếu truyền clientId cần cookie seat_session tương ứng. Kiểm tra xung đột, ghế còn trống và thời gian được thực hiện lại trong transaction.",
});
op("GET", "/api/trips", "Tìm chuyến công khai hoặc liệt kê chuyến quản trị", {
  auth: "optional-admin", response: "TripListResult", errors: [400, 401, 403, 500],
  queries: [q("admin", "admin=true bắt buộc phiên ADMIN; mặc định tìm chuyến công khai.", { enum: ["true", "false"] }), q("bookable", "Chỉ chế độ admin: lọc chuyến có thể đặt.", { enum: ["true", "false"] }), q("search", "Chỉ chế độ admin: từ khóa."), q("from", "Điểm đi; công khai nhận mã địa điểm hoặc tên."), q("to", "Điểm đến."), q("date", "Ngày đi YYYY-MM-DD theo giờ Việt Nam."), q("times", "Công khai: early,morning,afternoon,night; phân tách bằng dấu phẩy hoặc lặp tham số."), q("vehicles", "Công khai: limousine,sleeper,other; phân tách bằng dấu phẩy hoặc lặp tham số."), page, limit, q("sortBy", "Chỉ chế độ admin.", { enum: ["createdAt", "time", "price", "availableSeats", "id"] }), sortOrder],
  description: "Chế độ công khai chuẩn hóa bộ lọc và trả chuyến tương lai. Các tham số bookable, search, sortBy, sortOrder chỉ dùng khi admin=true; chế độ này kiểm tra quyền ADMIN.",
});
op("POST", "/api/trips", "Tạo chuyến xe", { auth: "admin", request: "TripInput", response: "DataResult", status: 201, errors: [400, 409, 500] });
op("GET", "/api/trips/{id}", "Xem chi tiết chuyến xe", { response: "DataResult", errors: [400, 404, 500] });
op("PUT", "/api/trips/{id}", "Cập nhật chuyến xe", { auth: "admin", request: "TripInput", response: "DataResult", errors: [400, 404, 409, 500] });
op("DELETE", "/api/trips/{id}", "Xóa chuyến xe", { auth: "admin", response: "DataResult", errors: [400, 404, 409, 500] });
op("GET", "/api/trips/locations", "Danh sách địa điểm phục vụ quản trị", { auth: "admin", response: "ArrayDataResult", errors: [500] });
op("GET", "/api/trips/{id}/holds", "Tải ghế đã đặt, ghế giữ và lựa chọn tạm", {
  queries: [clientId], response: "SeatStateResult", errors: [400, 404, 500],
  description: "Tạo cookie seat_session HttpOnly nếu chưa có; truyền cùng clientId khi mở stream và gửi thao tác. holds chỉ lộ seatNumber và isOwn, không lộ khóa sở hữu.",
});
op("GET", "/api/trips/{id}/stream", "Mở SSE đồng bộ ghế và số người xem", {
  queries: [clientId], response: "SeatRealtimeMessage", mediaType: "text/event-stream", errors: [400, 403, 404, 409, 500],
  description: "EventSource nhận data: JSON theo schema SeatRealtimeMessage, kết thúc mỗi thông điệp bằng hai newline. Snapshot ban đầu, sự kiện chọn/bỏ chọn, số người xem và SEATS_CHANGED. Heartbeat là comment mỗi 15 giây. Số người xem đếm clientId khác nhau. Lựa chọn tạm và broadcast chỉ tồn tại trong RAM cùng một tiến trình Node.js; chưa đồng bộ nhiều máy chủ.",
});
op("POST", "/api/trips/{id}/seat-events", "Gửi chọn hoặc bỏ chọn ghế realtime", {
  auth: "seat", request: "SeatInteractionInput", response: "Success", errors: [400, 403, 404, 409, 500],
  example: { tripId: 1, clientId: "example-tab", seatNumber: "A01", type: "SEAT_SELECTED" },
  description: "Cần kết nối SSE đang hoạt động của cùng clientId/cookie. tripId trong body phải khớp URL. Tối đa 5 ghế/client; 409 nếu ghế bị client khác chọn hoặc đã có vé. Đây là lựa chọn tạm, chưa phải vé hay SeatHold bền vững.",
});
op("PUT", "/api/trips/{id}/seat-events", "Đồng bộ lựa chọn sau khi kết nối lại", {
  auth: "seat", request: "SeatSyncInput", response: "Success", errors: [400, 403, 404, 409, 500],
  example: { tripId: 1, clientId: "example-tab", selectedSeats: ["A01"] },
  description: "Cần SSE đang hoạt động; tripId khớp URL; selectedSeats không trùng và tối đa 5. Client cần tải trạng thái holds/booked trước, loại ghế không còn khả dụng rồi mới đồng bộ. Không có hàng đợi thao tác offline.",
});
op("POST", "/api/seats/hold", "Giữ ghế có hạn hoặc giải phóng ghế giữ", {
  auth: "seat", request: "SeatHoldInput", response: "Success", errors: [400, 403, 404, 409, 500],
  example: { tripId: 1, clientId: "example-tab", seatNumber: "A01", action: "hold" },
  description: "Cookie seat_session được cấp từ holds/stream; clientId là mã tab. action=hold tạo SeatHold 5 phút trong CSDL; action=release giải phóng ghế thuộc phiên. UI chọn ghế hiện tại không tự gọi API giữ ghế này.",
});
op("GET", "/api/payments/status", "Kiểm tra trạng thái thanh toán theo PNR", { queries: [pnr], response: "PaymentResult", errors: [400, 404, 500], description: "Trả trạng thái thanh toán và các khoản received, refunded, refundDue, amountDue từ sổ thu/hoàn. bookingStatus là CONFIRMED, PENDING hoặc UNAVAILABLE. Cần biết mã PNR." });
op("POST", "/api/payments/demo/confirm", "Xác nhận thanh toán giả lập", {
  request: "DemoPaymentInput", response: "PaymentResult", example: { pnr: "NHAXE-1-EXAMPLE" }, errors: [400, 403, 404, 409, 500, 503],
  description: "Chỉ hoạt động khi PAYMENT_DEMO_ENABLED=true và cấu hình VietQR hợp lệ. Đây là giả lập, không gọi ngân hàng hoặc xác minh tiền thực nhận. Server tự tính tiền; từ chối vé hết hạn, bị hủy hoặc đã xuất bến. Cần biết PNR; endpoint không yêu cầu tài khoản admin.",
});
op("GET", "/api/admin/stats", "Thống kê dashboard quản trị", { auth: "admin", response: "DataResult", errors: [500], description: "Tiền theo kỳ tính bằng khoản thu trừ khoản hoàn phát sinh trong kỳ, không dựa trên trạng thái vé. Bốn số dư thu/hoàn/chờ hoàn/phải thu tính toàn bộ lịch sử; loại trừ giao dịch DEMO." });
op("GET", "/api/admin/dispatch", "Danh sách xe và tài xế để phân công chuyến", {
  auth: "admin", response: "DataResult", errors: [400, 500],
  queries: [q("time", "Giờ xuất bến: datetime-local theo giờ Việt Nam (đến phút) hoặc ISO có múi giờ; phải gửi cùng endsAt."), q("endsAt", "Giờ kết thúc, cùng định dạng time và phải sau time."), query("excludeTripId", integer("Bỏ qua chính chuyến đang sửa.", { minimum: 1, maximum: 2147483647 }))],
  description: "Mỗi tài xế có available, reason và conflictTripId. Không có khoảng giờ thì available=false, chưa xác định lịch rảnh. Chặn trùng lịch OPEN/DEPARTED; nếu giờ xuất bến đã đến thì mọi chuyến DEPARTED chưa hoàn thành cũng giữ tài xế, kể cả quá giờ kết thúc dự kiến. Phân công tương lai không bị chặn bởi chuyến hiện tại không trùng giờ. Server kiểm tra lại xe và tài xế trong transaction khi lưu chuyến.",
});
op("POST", "/api/admin/orders/{id}/payment", "Ghi nhận thu hoặc hoàn tiền của một vé", { auth: "admin", request: "OrderPaymentInput", response: "SuccessMessage", errors: [400, 404, 409, 500], example: { kind: "RECEIPT", method: "CASH" }, description: "Server tự tính số tiền còn phải thu/hoàn và lưu người xử lý từ phiên admin. Chỉ hoàn vé đã hủy. Ghi sổ không tự chuyển tiền qua ngân hàng; giao dịch demo không được tính vào báo cáo tiền thật." });
op("GET", "/api/admin/orders", "Tìm và phân trang lượt đặt theo PNR", { auth: "admin", queries: list(["status", "date", "tripId"], ["createdAt", "totalPrice", "id"]), response: "AdminListResult", errors: [400, 500], description: "Mỗi dòng là một PNR chứa toàn bộ tickets, kể cả vé đã hủy. Bộ lọc chọn PNR có ít nhất một vé phù hợp. pagination.total và stats.orderCount đếm lượt đặt; stats.total đếm vé; transactionCount đếm mã giao dịch thu/hoàn riêng biệt." });
op("POST", "/api/admin/orders", "Tạo vé tại quầy", { auth: "admin", request: "OfflineBookingInput", response: "BookingCreated", status: 201, example: { ...bookingExample, status: "CONFIRMED" }, errors: [400, 404, 409, 500] });
op("GET", "/api/admin/orders/{id}", "Xem chi tiết đơn hàng", { auth: "admin", response: "DataResult", errors: [400, 404, 500] });
op("PATCH", "/api/admin/orders/{id}", "Đổi trạng thái vé", { auth: "admin", request: "OrderStatusInput", response: "DataResult", errors: [400, 404, 409, 500], description: "CONFIRMED tương thích luồng cũ: ghi thu tiền mặt còn thiếu với người xử lý từ phiên admin. CANCELLED trả ghế nhưng giữ nguyên khoản thu, không tự hoàn tiền. PENDING dùng để khôi phục vé đã hủy; nếu tiền chưa hoàn vẫn đủ giá vé thì khôi phục CONFIRMED. Service kiểm tra xung đột ghế trong transaction." });
op("DELETE", "/api/admin/orders/{id}", "Hủy vé và giữ lịch sử", { auth: "admin", response: "SuccessMessage", errors: [400, 404, 409, 500], description: "Không xóa lịch sử; chuyển vé về CANCELLED và hoàn ghế theo quy tắc nghiệp vụ." });

for (const [resource, label, request, filters, sorts] of [
  ["buses", "xe", "BusInput", ["type", "status"], ["plate", "capacity", "createdAt", "id"]],
  ["employees", "nhân viên", "EmployeeInput", ["role", "department", "status"], ["name", "createdAt", "id"]],
  ["users", "tài khoản", "UserInput", ["role"], ["createdAt", "fullName", "id"]],
]) {
  const base = `/api/${resource}`;
  op("GET", base, `Tìm và phân trang ${label}`, { auth: "admin", queries: [...list(filters, sorts), ...(resource === "buses" ? [q("selectable", "true: trả toàn bộ xe đang hoạt động để chọn khi tạo/sửa chuyến; không phân trang.", { enum: ["true", "false"] })] : [])], response: resource === "buses" ? "DataResult" : "AdminListResult", errors: [500] });
  op("POST", base, `Tạo ${label}`, { auth: "admin", request, response: "DataResult", status: 201, errors: [400, 409, 500], ...(resource === "users" ? { description: "Ngoài schema Zod chung, service bắt buộc password cho tài khoản mới và từ chối role=CUSTOMER; tài khoản CUSTOMER phải tạo qua /api/auth/register." } : {}) });
  op("GET", `${base}/{id}`, `Xem chi tiết ${label}`, { auth: "admin", response: "DataResult", errors: [404, 500] });
  op("PUT", `${base}/{id}`, `Cập nhật ${label}`, { auth: "admin", request, response: "DataResult", errors: [400, 404, 409, 500] });
  op("DELETE", `${base}/{id}`, `Xóa ${label}`, { auth: "admin", response: "SuccessMessage", errors: [404, 409, 500] });
}
op("PATCH", "/api/buses/{id}/status", "Đổi trạng thái hoạt động của xe", { auth: "admin", request: "BusStatusInput", response: "DataResult", errors: [400, 404, 500] });
op("PATCH", "/api/employees/{id}/status", "Đổi trạng thái nhân viên", { auth: "admin", request: "EmployeeStatusInput", response: "DataResult", errors: [400, 404, 500] });
op("PATCH", "/api/users/{id}/role", "Đổi vai trò tài khoản", { auth: "admin", request: "UserRoleInput", response: "DataResult", errors: [400, 404, 409, 500], description: "Endpoint này chỉ chấp nhận USER hoặc ADMIN. Các quy tắc không tự hạ quyền/vô hiệu hóa quản trị viên cuối cùng được service kiểm tra." });
op("GET", "/api/openapi", "Tải đặc tả OpenAPI của API hiện tại", { response: "OpenApiDocument", description: "Đặc tả tĩnh được sinh từ route, schema Zod và metadata đã rà soát; không truy cập CSDL." });

module.exports = { metadata };
