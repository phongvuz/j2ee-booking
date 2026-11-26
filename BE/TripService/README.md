# TripService

Một ứng dụng Spring Boot quản lý cả xe (`bus`) và chuyến đi (`trip`), sử dụng PostgreSQL.
Yêu cầu Java 21 trở lên và Maven 3.9 trở lên.

## Cấu trúc

```text
src/main/java/TripService/
├── bus/
│   ├── controller/       # HTTP, validation và mã trạng thái
│   ├── dto/              # Request/response, không trả entity qua API
│   ├── entity/           # Ánh xạ bảng buses
│   ├── mapper/           # Chuyển DTO <-> entity
│   ├── repository/       # Truy vấn database qua Spring Data JPA
│   └── service/
│       └── impl/         # Nghiệp vụ, transaction
├── trip/                 # Các lớp tương tự cho chuyến đi
└── common/
    ├── dto/              # Kết quả phân trang
    └── exception/        # Lỗi nghiệp vụ và xử lý lỗi HTTP tập trung
```

Controller phụ thuộc vào interface `BusService` hoặc `TripService`; implementation nhận
repository qua constructor injection. Mỗi lớp có một trách nhiệm, không dùng lớp CRUD
cha hoặc interface chung chứa những phương thức không liên quan. Mapper chỉ chuyển đổi
dữ liệu; các quyết định như xe có được nhận chuyến và số ghế khi đổi xe nằm ở service.
Các interface service là hợp đồng cho phép thay implementation mà controller không đổi.

## Chạy với PostgreSQL

Khởi động PostgreSQL và tạo database `booking` bằng pgAdmin hoặc `psql`:

```sql
CREATE DATABASE booking;
```

Khi ứng dụng khởi động, `src/main/resources/db/schema-postgresql.sql` tạo hai bảng
`buses`, `trips` và index tìm kiếm nếu chưa có. Script không xóa dữ liệu và không
chèn dữ liệu mẫu. Có thể dùng `script-db.txt` ở thư mục gốc nếu cần các bảng khác
và dữ liệu mẫu cho toàn hệ thống.

Cấu hình tại terminal PowerShell (điền mật khẩu PostgreSQL của bạn):

```powershell
$env:DB_URL = 'jdbc:postgresql://localhost:5432/booking'
$env:DB_USERNAME = 'postgres'
$env:DB_PASSWORD = '<mat-khau-postgresql>'
mvn spring-boot:run
```

Chạy lệnh trong `BE/TripService`. Có thể dùng `./mvnw.cmd` thay `mvn`.
API mặc định tại `http://localhost:8080`. Hibernate dùng `ddl-auto: validate`,
kiểm tra entity khớp schema sau bước khởi tạo SQL. Với bảng đã tồn tại, script dùng
`IF NOT EXISTS`, không tự thay đổi cấu trúc cột.

## API

| Method | URL | Chức năng |
| --- | --- | --- |
| POST | `/api/buses` | Tạo xe |
| GET | `/api/buses?page=0&size=20` | Danh sách xe |
| GET | `/api/buses/{id}` | Chi tiết xe |
| PUT | `/api/buses/{id}` | Thay thế thông tin xe |
| DELETE | `/api/buses/{id}` | Xóa xe chưa có chuyến |
| POST | `/api/trips` | Tạo chuyến |
| GET | `/api/trips` | Danh sách/tìm kiếm chuyến |
| GET | `/api/trips/{id}` | Chi tiết chuyến |
| PUT | `/api/trips/{id}` | Thay thế thông tin chuyến |
| DELETE | `/api/trips/{id}` | Xóa chuyến chưa có ghế được đặt |

`PUT` gửi đầy đủ các trường như khi tạo. Danh sách trả về `content`, `page`, `size`,
`totalElements`, `totalPages`; `page` bắt đầu từ 0, `size` từ 1 đến 100.
Tìm kiếm chuyến hỗ trợ các tham số tùy chọn kết hợp: `departure`, `destination`,
`departureDate` (`yyyy-MM-dd`), `busId`, `page`, `size`.
Điểm đi/đến được so khớp toàn bộ, không phân biệt hoa thường và bỏ khoảng trắng hai đầu.

Tạo xe:

```json
{
  "busCode": "BUS-010",
  "plateNumber": "51B-555.55",
  "type": "Limousine 22 phòng",
  "seatCount": 22,
  "status": "ACTIVE"
}
```

Tạo chuyến (`busId` lấy từ response tạo xe):

```json
{
  "tripCode": "VN10",
  "busId": 1,
  "departure": "SGN",
  "destination": "DLT",
  "departureDate": "2026-12-01",
  "departureTime": "21:00:00",
  "price": 300000.00
}
```

Response chuyến chứa thông tin xe trong trường `bus`. Số ghế trống `emptySeats` do
server khởi tạo từ sức chứa của xe, không nhận từ request CRUD.

## Quy tắc nghiệp vụ

- Mã xe, biển số và mã chuyến không được trùng; database cũng có unique constraint.
- Chỉ xe `ACTIVE` được gán khi tạo/cập nhật chuyến.
- Điểm đi và điểm đến phải khác nhau; giá vé không âm, tối đa 10 chữ số nguyên và 2 số lẻ.
- Một xe không được có hai chuyến cùng ngày và giờ khởi hành. Khi phân công xe,
  service khóa bản ghi xe trong transaction để tuần tự hóa các request cùng xe.
- Xe đã có chuyến không được xóa hoặc thay đổi số ghế.
- Cập nhật chuyến trên cùng xe giữ nguyên số ghế trống. Chỉ được đổi xe khi chưa có
  ghế được đặt; sau khi đổi, số ghế trống bằng sức chứa xe mới.
- Chuyến có ghế đã đặt không được xóa. Các khóa ngoại có sẵn vẫn ngăn xóa dữ liệu
  đang được đơn vé tham chiếu.

Lỗi dùng định dạng `ProblemDetail`: `400` cho dữ liệu không hợp lệ, `404` khi không
tìm thấy, `409` cho xung đột nghiệp vụ/dữ liệu. Lỗi validation request có thêm `errors`
theo tên trường. Thao tác tạo trả `201` kèm `Location`; xóa thành công trả `204`.

Schema hiện chỉ có giờ khởi hành, chưa có giờ kết thúc nên kiểm tra lịch mới chặn
trùng thời điểm khởi hành, chưa phát hiện mọi khoảng thời gian chuyến bị chồng lấn.
Luồng đặt/giữ ghế và xác thực/phân quyền chưa được triển khai trong phần này.

## Kiểm thử

Kiểm thử cũng dùng PostgreSQL. Tạo database riêng một lần:

```sql
CREATE DATABASE booking_test;
```

Thiết lập kết nối kiểm thử riêng trong PowerShell rồi chạy tại `BE/TripService`:

```powershell
$env:TEST_DB_URL = 'jdbc:postgresql://localhost:5432/booking_test'
$env:TEST_DB_USERNAME = 'postgres'
$env:TEST_DB_PASSWORD = '<mat-khau-postgresql>'
mvn test
```

Profile `test` dùng schema `tripservice_test` và SQL tạo bảng giống ứng dụng.
Tài khoản kiểm thử cần quyền tạo schema và bảng trong database kiểm thử.
Các test xóa dữ liệu trong schema kiểm thử trước mỗi ca; không dùng cấu hình
`DB_URL`/`DB_USERNAME`/`DB_PASSWORD` của ứng dụng. Một test xác nhận kết nối thực sự
là PostgreSQL và đang ở đúng schema kiểm thử.

Bao gồm CRUD, tìm kiếm/phân trang, validation, dữ liệu trùng, xe không hoạt động,
bảo vệ xe đang có chuyến, giữ nguyên số ghế đã đặt khi cập nhật chuyến và hai request
đồng thời phân công cùng xe tại cùng thời điểm khởi hành.
