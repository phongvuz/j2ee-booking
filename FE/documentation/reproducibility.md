# Chạy demo bằng một lệnh

Yêu cầu: Node.js 22 kèm npm, một MySQL 8.0.16+ trên máy và tài khoản MySQL có quyền tạo database. Cài và khởi động MySQL trước khi chạy. Kết nối tới máy chủ từ `DEMO_SERVER_URL`, hoặc dùng thông tin kết nối trong `DATABASE_URL` của `.env` hiện có; script chỉ lấy máy chủ/tài khoản, không sửa database ứng dụng trong URL đó. Phiên bản và kết quả đã chạy thực tế được ghi trong biên bản kiểm thử, không suy ra từ yêu cầu tối thiểu này.

Nếu chưa có `.env`, đặt biến môi trường `DEMO_SERVER_URL=mysql://<user>:<password>@127.0.0.1:3306/mysql` bằng cơ chế của terminal. Mật khẩu có ký tự đặc biệt phải được URL encode. Không đưa giá trị thật lên Git. Script chỉ chấp nhận máy chủ loopback, không kết nối database từ xa.

Tại thư mục dự án, chạy:

```text
node scripts/demo.cjs
```

Lệnh tự chạy `npm ci` nếu thiếu dependency, chuẩn bị Prisma Client, tạo database riêng `sgu_booking_demo`, áp dụng snapshot schema hiện tại, tạo dữ liệu mẫu và chạy Next.js dev tại **http://127.0.0.1:3001**. Nếu schema đã sinh khớp mã nguồn và model/field thực tế của Prisma Client khớp đủ, script bỏ qua generate để tránh đụng DLL đang được tiến trình khác dùng trên Windows. Client thiếu/cũ phải được sinh lại; nếu DLL bị khóa, script dừng trước bước khởi tạo demo. Dữ liệu ứng dụng cũ và `.env` được giữ nguyên. Có thể dùng `npm run demo` sau khi npm sẵn sàng.

Tài khoản minh họa (không dùng cho môi trường triển khai):

| Loại tài khoản | Đăng nhập | Mật khẩu mặc định | Trang đăng nhập |
|---|---|---|---|
| ADMIN | `0911000001` | `Demo@12345` | `/admin/login` |
| CUSTOMER | `0911000002` hoặc `customer@example.test` | `Demo@12345` | Nút Đăng nhập trên trang khách |

Hai tài khoản được băm mật khẩu bằng scrypt. Có thể đặt `DEMO_PASSWORD` trước lần tạo database mới; không tự đổi mật khẩu khi chạy lại. Dữ liệu gồm sáu chuyến trong tương lai tính từ thời điểm khởi tạo, hai xe, một nhân viên và một vé đã xác nhận để xem lịch sử khách hàng. Chạy lại dùng nguyên dữ liệu đã tạo, bao gồm các thao tác demo trước đó. Không tự sửa ngày đi của chuyến cũ.

Script bật nút xác nhận **thanh toán mô phỏng**. Thông tin VietQR được thay bằng dữ liệu minh họa; **không chuyển tiền thật**. Dùng chức năng xác nhận demo để hoàn tất lượt đặt vé. Máy cần Internet khi cài npm, tải font Google lần đầu và tải ảnh QR ngoài hệ thống. Đây là môi trường trình diễn cục bộ, không phải cấu hình triển khai công khai.

## Chạy lại và kiểm thử

- Dừng ứng dụng bằng `Ctrl+C`. Database demo vẫn còn.
- Chạy lại cùng lệnh: script chỉ đọc marker sở hữu/schema và dùng lại dữ liệu. Không reset, không seed lại, không tự cập nhật schema database đã tồn tại.
- Nếu tên đã tồn tại nhưng không có marker hợp lệ, hoặc schema mã nguồn đã đổi, script dừng và giữ nguyên database đó. Chọn một tên mới theo mẫu `sgu_booking_demo_<suffix>`.
- `SESSION_SECRET` riêng được tạo trong bộ nhớ mỗi lần khởi chạy; sau khi khởi động lại cần đăng nhập lại. Không ghi secret ra file.
- Cookie đăng nhập demo dùng `demo_admin_session` và `demo_customer_session`, tách khỏi cookie ứng dụng để hai bản không ghi đè hoặc đăng xuất lẫn nhau.

Chỉ khởi tạo, không mở web server:

```text
node scripts/demo.cjs --database sgu_booking_demo_qa_20261106 --no-start
```

Lặp lại chính lệnh trên để kiểm tra việc dùng lại dữ liệu. Đổi suffix nếu tên đã được dùng bởi một lần chạy có schema khác. Script không có chức năng xóa database. Khi muốn một demo mới, tạo database demo tên mới. Đổi cổng bằng `--port 3011` nếu cổng 3001 đang dùng.

Kiểm thử không kết nối database:

```text
node --test --test-isolation=none tests/demo.test.cjs
```

Kiểm thử tích hợp tạo một database demo tên ngẫu nhiên, giữ lại để kiểm tra, không mở server:

```text
node tests/demo-db.cjs
```

Kết quả đã quan sát ngày **06/11/2026** trên **MySQL 8.0.46**: 11/11 kiểm thử đơn vị đạt; khởi tạo database mới và lặp lại cùng lệnh đều thành công; kiểm thử tích hợp xác nhận seed, CHECK/FK/unique, giữ dữ liệu khi chạy lại và từ chối database không thuộc demo. [Biên bản có lệnh kiểm tra và SHA-256 mã nguồn](./reproducibility-evidence.json) ghi rõ phạm vi, database QA được giữ lại và các nhánh chưa chạy. Chưa kiểm thử Docker hoặc nhánh `npm ci` từ thư mục dependencies trống.

## Phạm vi schema và migration

Đường demo dùng `prisma db push` **chỉ sau khi tự tạo được một database mới**. Giữ nguyên unique index và khóa ngoại của datamodel, sau đó thêm CHECK sức chứa, trạng thái vé, ghế hiệu lực và số tiền. Đường này không triển khai chuỗi migration lịch sử, không ghi migration thành công giả và không thay đổi checksum migration đã áp dụng. Không dùng `db:upgrade` hoặc `db:deploy` để nâng cấp database demo này; tạo demo tên mới khi schema thay đổi.

Snapshot demo đổi riêng FK `booking.tripId` sang `ON UPDATE RESTRICT`. MySQL không cho CHECK `activeSeat` tham chiếu `tripId` khi FK có `ON UPDATE CASCADE` (lỗi 3823). ID chuyến xe không đổi trong các thao tác ứng dụng, nên lựa chọn RESTRICT giữ được cả FK và CHECK mà không sửa file schema/migration gốc. Kiểm thử tích hợp kiểm tra các ràng buộc này cùng việc từ chối seed lại hoặc tiếp quản database không thuộc demo.

Phần báo cáo cần phân biệt kết quả kiểm thử thực tế với cấu hình đã chuẩn bị. Một lệnh có thể dựng và chạy demo sau khi các điều kiện Node/MySQL/quyền truy cập ở trên đã sẵn sàng; không tự cài dịch vụ MySQL hay bỏ qua thiếu quyền.
