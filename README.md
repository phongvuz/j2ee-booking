# Backend - Hệ thống đặt vé xe khách (Spring Boot)

## Yêu cầu
- JDK 17
- Docker Desktop (chạy PostgreSQL)
- IntelliJ IDEA (hoặc dùng `./mvnw` / `mvnw.cmd` có sẵn)

## Chạy lần đầu
```sh
# 1. (tuỳ chọn) tạo file cấu hình riêng
cp .env.example .env

# 2. bật PostgreSQL
docker compose up -d

# 3. chạy ứng dụng (Flyway tự tạo bảng và nạp dữ liệu mẫu)
./mvnw spring-boot:run          # Windows: mvnw.cmd spring-boot:run
```
Kiểm tra: mở http://localhost:8080/api/v1/health -> `{"status":"UP","service":"booking"}`

## Cấu trúc (chia theo tầng, giống project mẫu CNLT-HD-T7)
```text
src/main/java/com/nhom/booking
├── config/         CorsConfig (sau này thêm SecurityConfig)
├── controllers/    REST controller, prefix /api/v1/...
├── dtos/           dtos/order, dtos/trip, ...
├── entities/       JPA entity
├── exception/      GlobalExceptionHandler + exception chung
├── interfaces/     IOrder, ITrip, ... (controller chỉ gọi interface)
├── mappers/        entity <-> DTO (class static)
├── repositories/   Spring Data JPA
└── services/       nghiệp vụ, @Transactional
```

## Quy ước chung
- Prefix API: `/api/v1/...`
- Lỗi trả về dạng: `{ "status": 404, "error": "Not Found", "message": "...", "details": {...} }`
  - `ResourceNotFoundException` -> 404, `DuplicateResourceException` -> 409, `IllegalArgumentException` -> 400.
- Database do **Flyway** quản lý, Hibernate chỉ `validate`:
  - `V1__create_tables.sql`: bảng; `V2__seed_data.sql`: dữ liệu mẫu (ngày đi chuyến mẫu = hôm nay + 7).
  - Khi đã merge vào `develop` và cả nhóm đã chạy, **không sửa V1/V2 nữa**, hãy tạo `V3__...sql` mới.
  - Muốn nạp lại từ đầu trên máy mình: `docker compose down -v` rồi `docker compose up -d`.
- CORS: mặc định cho phép `http://localhost:3000` (Next.js). Đổi bằng biến `CORS_ALLOWED_ORIGINS`.
- Chưa có Spring Security/JWT (Người 4 sẽ thêm). Khi thêm, nhớ bật `.cors(...)` trong `SecurityFilterChain`.

## API Order & Booking (`/api/v1/orders`)
| Method | Đường dẫn | Việc | Ghi chú |
|---|---|---|---|
| GET | `/` | Danh sách, lọc `keyword`, `status`, phân trang `page`, `size` | TODO: chỉ ADMIN |
| GET | `/search?pnr=&phone=` | Tra cứu công khai, cần cả PNR và SĐT | public |
| GET | `/{id}` | Chi tiết đơn | TODO: chủ đơn/ADMIN |
| POST | `/` | Đặt vé (`tripId`, `userId`, `customerName`, `customerPhone`, `seats`) | 201; 409 nếu ghế trùng. TODO: bỏ `userId`, lấy từ JWT |
| PUT | `/{id}` | Sửa tên, SĐT khách | không sửa được đơn đã hủy |
| PATCH | `/{id}/pay` | Xác nhận thanh toán (PENDING -> PAID) | 409 nếu sai trạng thái |
| DELETE | `/{id}` | Hủy đơn (xóa mềm, trả ghế) | 204 |

- Đơn `PENDING` quá `app.order.pending-timeout-minutes` (mặc định 15 phút) sẽ tự hủy, ghế được trả lại.
- Chống đặt trùng ghế: khóa dòng chuyến + `UNIQUE (trip_id, seat_code)` trong database.
- `Trip`, `User`, `TripRepository`, `UserRepository` hiện là **bản tạm** của module Order, thay bằng bản của người phụ trách khi họ push.

- `GET /api/v1/trips/{tripId}/booked-seats` (công khai): ghế đã có người đặt của chuyến, dạng `{ "tripId": 3, "bookedSeats": ["1A1"] }`. Frontend dùng để tô xám ghế. `tripId` là **id số trong DB**, không phải mã chuyến `VN03`.
- Mã ghế: `<tầng><hàng><số>`, vd `1A1` = tầng dưới, hàng A, ghế 1 (frontend hiển thị `A1` trong khối "Tầng Dưới").
