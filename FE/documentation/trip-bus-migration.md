# Chuyển sức chứa sang xe và gán xe cho chuyến

## Mô hình và giao diện

`bus.capacity` là nơi lưu sức chứa, kiểu số nguyên từ 1 đến 60. Cột cũ `bus.seats` được đổi tên thành `capacity`. Bảng `trip` bỏ `capacity`, thêm `busId` bắt buộc tham chiếu `bus.id`, có index `trip_busId_idx` và khóa ngoại `trip_busId_fkey` với `ON DELETE RESTRICT`, `ON UPDATE RESTRICT`.

Một xe có thể liên kết với nhiều chuyến. Số ghế trống của từng chuyến vẫn được lưu riêng tại `trip.availableSeats`:

```text
availableSeats = bus.capacity - số vé PENDING/CONFIRMED của chuyến
```

API/props phục vụ giao diện vẫn có thể có `capacity` hoặc `totalSeats`; đây là giá trị suy ra từ xe liên quan, không phải cột được lưu lại trên `trip`. Sơ đồ ghế, đặt vé, giữ ghế và khôi phục vé đều đọc sức chứa từ xe của chuyến. Bộ lọc loại xe sử dụng `bus.type`.

Tại `/admin/trips`, form tạo/sửa chuyến yêu cầu chọn xe và hiển thị sức chứa của xe đã chọn. Danh sách chọn gồm xe đang hoạt động; khi sửa, xe đang gán vẫn được hiển thị để giữ nguyên thông tin chuyến kể cả khi xe đó đã đổi trạng thái. Bảng và chi tiết chuyến hiển thị biển số, loại xe và sức chứa.

## Payload API

Tạo chuyến bằng `POST /api/trips`; cập nhật bằng `PUT /api/trips/{id}`. Hai thao tác yêu cầu phiên ADMIN. Payload form gồm `from`, `to`, `time`, `price`, `busId`; server lấy sức chứa từ xe và tự tính ghế trống. Ví dụ sau cần thay `busId` bằng xe đang hoạt động trong database và chọn thời gian xuất bến trong tương lai:

```json
{
  "from": "Hồ Chí Minh",
  "to": "Đà Lạt",
  "time": "2027-01-15T08:00",
  "price": 300000,
  "busId": "SAMPLE-TRIP-6"
}
```

Khi tạo/sửa xe, gửi `capacity` thay cho `seats`. Không gửi `capacity` hoặc `availableSeats` để điều khiển sức chứa/số ghế trống của chuyến.

## Quy tắc giữ nguyên dữ liệu vé

- Xe đã liên kết với bất kỳ chuyến nào không được xóa hoặc đổi sức chứa. Có thể tạo xe khác rồi chọn xe đó cho chuyến theo các điều kiện bên dưới.
- Xe mới được chọn khi tạo/đổi xe phải đang hoạt động. Giữ nguyên xe cũ khi sửa thông tin khác không bắt buộc đổi xe.
- Khi có giữ ghế còn hạn, chưa được đổi xe. Sau khi hết giữ ghế, chuyến có bất kỳ lịch sử vé nào, kể cả vé đã hủy, chỉ được đổi sang xe cùng sức chứa; mã ghế trong lịch sử phải thuộc sơ đồ xe mới.
- Chuyến chưa có lịch sử vé và không còn giữ ghế còn hạn có thể đổi sang xe khác sức chứa; server tính lại `availableSeats` từ xe và vé hiệu lực. Giữ ghế hết hạn nằm ngoài sơ đồ mới được dọn khi cập nhật chuyến.
- Chuyến có vé hiệu lực không được đổi hành trình hoặc giờ xuất bến. Giá chuyến mới không sửa giá đã lưu trên vé.

Các thao tác thay đổi xe/chuyến thực hiện trong transaction `Serializable`. CHECK trên database bảo vệ `bus.capacity` trong 1–60 và `trip.availableSeats` trong 0–60. Điều kiện liên bảng `availableSeats <= bus.capacity` và quy tắc lịch sử vé được service kiểm tra; SQL CHECK không tham chiếu sang bảng xe.

## Chuyển một database import cũ

Công cụ sửa riêng: `scripts/setup-trip-buses.cjs`. Công cụ đọc `DATABASE_URL` từ môi trường/`.env`. Chạy từ thư mục gốc repository và kiểm tra đúng database được cấu hình trước khi áp dụng.

Đọc kế hoạch tạo xe mẫu và gán cho từng chuyến, chưa ghi dữ liệu hoặc tạo backup:

```sh
node scripts/setup-trip-buses.cjs --check --sample-buses
```

Dừng Next.js, worker hết hạn vé và các tiến trình có thể ghi vào database. Giữ bản sao lưu đầy đủ của database bằng công cụ MySQL trước khi nâng cấp. Áp dụng phương án tạo xe mẫu đã được yêu cầu:

```sh
node scripts/setup-trip-buses.cjs --sample-buses
npx prisma generate
node scripts/setup-trip-buses.cjs --check --sample-buses
```

Trước DDL đầu tiên, helper kiểm tra schema, sức chứa, mã ghế, ghế trống và vé hiệu lực; lưu schema cùng rows của `bus`, `trip`, `booking`, `SeatHold` vào `.local-backups/before-trip-buses-<timestamp>-<suffix>.json` và `fsync` file. Đường dẫn thực tế được trả trong `backupPath`. Bản sao này chứa dữ liệu hành khách; giữ tại máy, không đưa vào Git hoặc hồ sơ công khai.

Helper đối chiếu lại snapshot trước DDL và kiểm tra dữ liệu vé, giữ ghế, các trường chuyến sau chuyển đổi. MySQL tự commit DDL nên toàn bộ lần nâng cấp không phải một transaction có thể rollback bằng một lệnh. Nếu gặp lỗi, giữ backup và kiểm tra schema/kết quả trước khi chạy tiếp; helper hỗ trợ chạy lại những giai đoạn chuyển đổi đã nhận diện được. Khi schema đã đúng và dữ liệu hợp lệ, chạy lại trả `changed: false`, không tạo thêm xe hoặc backup.

Database đã có thu/hoàn tiền và phân công tài xế vẫn có thể còn `bus.seats`, `trip.capacity` và `trip.busId` nullable. Helper giữ nguyên xe đã phân công, tài xế, giờ kết thúc và trạng thái chuyến; chỉ tạo bản ghi xe chưa xác minh cho chuyến còn thiếu xe. Khóa ngoại phân công cũ có `ON UPDATE CASCADE` được chuyển sang `RESTRICT` bằng tên tạm để tránh lỗi MySQL 1826; chạy lại nhận diện được giai đoạn này. Không sửa lịch sử migration đã áp dụng. Chạy `npm run test:trip-bus-dispatch-db` để kiểm tra trường hợp này trên database tạm, bao gồm việc giữ nguyên sổ thu/hoàn và phục hồi sau gián đoạn.

Helper không xóa/reset database, không sửa PNR/giá vé, không tự chuyển `trip.price` hoặc `booking.totalPrice` sang kiểu khác. Nó không ghi `_prisma_migrations`, không xác nhận baseline và không tự xử lý các lệch schema khác. Không sửa checksum migration cũ hoặc dùng `migrate resolve` chỉ để bỏ qua lỗi. Lỗi MySQL 3823 trong chuỗi migration lịch sử vẫn cần xử lý riêng khi sử dụng `db:upgrade`/`db:deploy`.

Sau khi đối chiếu kết quả, chạy kiểm tra source rồi khởi động lại ứng dụng:

```sh
npm run typecheck
npm test
npm run build
npm start
```

## Hai phương án gán dữ liệu cũ

Không có thông tin phân công xe trong dữ liệu cũ, nên không tự chọn một xe có sẵn chỉ vì cùng sức chứa.

| Cách chạy | Xe được tạo cho mỗi chuyến chưa có xe |
|---|---|
| Helper mặc định, không có `--sample-buses` | `LEGACY-TRIP-<id>`, trạng thái `Ngừng hoạt động`, ghi rõ chưa xác minh xe thực tế; sức chứa giữ nguyên từ chuyến cũ |
| Helper có `--sample-buses` | `SAMPLE-TRIP-<id>`, trạng thái `Đang hoạt động`, biển số minh họa `50F-<90000 + id>`, ghi chú xe mẫu; sức chứa giữ nguyên từ chuyến cũ |

Tuỳ chọn xe mẫu chỉ áp dụng khi backfill những chuyến chưa có `busId`; nó không đổi xe đã được gán hoặc biến các placeholder đã chuyển trước đó thành xe mẫu. Nếu mã xe/biển số dự kiến đã tồn tại hoặc ID vượt dải biển số mẫu hỗ trợ, helper dừng để đối chiếu.

Database cục bộ `sgu-booking` đã được chuyển đổi lúc 03:43 ngày 07/11/2026 (UTC+7). Theo yêu cầu bổ sung dữ liệu xe, tám xe mẫu đang hoạt động đã được tạo và gán cho tám chuyến:

| tripId | busId đã gán | Biển số mẫu | Sức chứa giữ nguyên |
|---:|---|---|---:|
| 6 | SAMPLE-TRIP-6 | 50F-90006 | 34 |
| 7 | SAMPLE-TRIP-7 | 50F-90007 | 23 |
| 8 | SAMPLE-TRIP-8 | 50F-90008 | 30 |
| 9 | SAMPLE-TRIP-9 | 50F-90009 | 26 |
| 10 | SAMPLE-TRIP-10 | 50F-90010 | 34 |
| 11 | SAMPLE-TRIP-11 | 50F-90011 | 28 |
| 13 | SAMPLE-TRIP-13 | 50F-90013 | 30 |
| 14 | SAMPLE-TRIP-14 | 50F-90014 | 3 |

Đây là ánh xạ dữ liệu mẫu theo sức chứa đã có, không phải xác nhận thông tin xe thực tế. Đối chiếu sau áp dụng xác nhận 24 bản ghi vé và 2 bản ghi giữ ghế không đổi theo hash; các trường chuyến, ghế trống và sức chứa suy ra từ xe khớp trước chuyển đổi. Chạy lại kiểm tra trả `changed: false`. Lịch sử migration không bị sửa.

Bản sao lưu và biên bản cục bộ của lần áp dụng này:

- Backup SQL đầy đủ: `.local-backups/before-trip-bus-full-2026-11-06T204357276Z.sql`.
- Backup JSON của helper: `.local-backups/before-trip-buses-1793997837465-f69d7f88.json`.
- Biên bản đối chiếu: `.local-backups/trip-bus-application-2026-11-06T204357276Z.json`.

Các file này chỉ lưu cục bộ vì chứa dữ liệu database; không đưa vào Git. Khi kiểm tra database khác hoặc bản import khác, phải chạy lại kiểm tra và đọc kết quả của chính database đó.

## Đối chiếu sau chuyển đổi

Các truy vấn sau chỉ đọc database hiện đang chọn:

```sql
SELECT t.id, t.busId, b.plate, b.type, b.capacity, t.availableSeats
FROM trip AS t
JOIN bus AS b ON b.id = t.busId
ORDER BY t.id;

SELECT t.id, b.capacity, t.availableSeats,
       COUNT(bk.id) AS activeBookings
FROM trip AS t
JOIN bus AS b ON b.id = t.busId
LEFT JOIN booking AS bk ON bk.tripId = t.id AND bk.status <> 'CANCELLED'
GROUP BY t.id, b.capacity, t.availableSeats
HAVING t.availableSeats + COUNT(bk.id) <> b.capacity;
```

Truy vấn thứ hai phải không trả dòng sai lệch. Kiểm tra trong quản trị rằng mỗi chuyến hiển thị đúng xe, form chọn xe lấy đúng sức chứa và số vé/số ghế trống không đổi do chuyển đổi.

## Migration và kiểm thử liên quan

Migration mới nằm tại `prisma/admin-migrations/20261106010000_trip_bus_relation/migration.sql`. Nó dùng placeholder thận trọng cho dữ liệu không có phân công xe và không sửa migration đã áp dụng. Với database import không có lịch sử Prisma phù hợp, dùng helper theo quy trình ở trên; không chạy riêng migration SQL lên schema đã chuyển đổi.

`node tests/trip-bus-db.cjs` kiểm tra forward SQL migration, helper backfill/xe mẫu, backup, khóa ngoại/CHECK và chạy lại trên database local riêng. Nó cần quyền tạo database và thay đổi schema trong database kiểm thử; database được giữ lại để đối chiếu, tên được in ở cuối kết quả. Không ghi vào database ứng dụng lấy từ `DATABASE_URL`. Unit test tại `tests/setup-trip-buses.test.cjs` kiểm tra kế hoạch không ghi, điều kiện từ chối, no-op và việc lỗi lưu backup ngăn DDL. Demo/seed mới tạo xe trước khi tạo chuyến và gán `busId` rõ ràng.
