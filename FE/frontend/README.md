# Nhà xe Sài Gòn

Đăng nhập/đăng ký dùng modal và cookie phiên 24 giờ; đăng ký tự đăng nhập, trang/API quản trị yêu cầu ADMIN. Chi tiết: [docs/authentication.md](docs/authentication.md).

Hướng dẫn Realtime chọn ghế bằng SSE, giải thích từng file và kiểm thử hai trình duyệt: [docs/seat-realtime.md](docs/seat-realtime.md).

Quản trị đã tách trạng thái vé khỏi sổ thu/hoàn tiền, gom lượt đặt theo PNR và kiểm tra phân công xe/tài xế. Hướng dẫn nghiệp vụ và cách đọc code cho người mới: [documentation/admin-finance-dispatch.md](documentation/admin-finance-dispatch.md).

Ứng dụng đặt vé xe dùng Next.js App Router, React, TypeScript, Prisma và MySQL. Khách có thể tìm chuyến, chọn ghế, tra cứu vé; trang `/admin` quản lý chuyến xe, vé, xe, nhân viên và tài khoản.

## Chạy ở máy cá nhân

Cần Node.js 20.9 trở lên và MySQL đang chạy.

```sh
npm ci
```

Tạo file `.env` tại thư mục gốc, thay các giá trị mẫu bằng cấu hình của bạn:

```dotenv
DATABASE_URL="mysql://DB_USER:DB_PASSWORD@localhost:3306/nha_xe_sai_gon"
SESSION_SECRET="thay-bang-chuoi-ngau-nhien-it-nhat-32-ky-tu"
```

Tạo Prisma Client, chạy migration cho database mới và khởi động ứng dụng:

```sh
npx prisma generate
npm run db:deploy
npm run dev
```

Database đã import từ SQL cần đối chiếu schema và lịch sử trước khi nâng cấp. `npm run db:upgrade` kiểm tra dữ liệu, sao lưu vào `.local-backups/`, bổ sung bảng còn thiếu, đối chiếu baseline và chạy migration khi cấu trúc tương thích. Với bản import cũ còn `trip.capacity` và `bus.seats`, xem [chuyển sức chứa sang xe và gán xe cho chuyến](documentation/trip-bus-migration.md). Không chạy reset để ép khớp schema.

Migration đang dùng nằm tại `prisma/admin-migrations/` và được khai báo trong `prisma.config.ts`. Thư mục `prisma/migrations/` giữ lịch sử cũ để đối chiếu. Script nâng cấp dừng nếu database đang dùng một lịch sử migration khác.

Chuyến xe dùng `id` tự tăng và `tripId` kiểu số nguyên dương. API JSON nhận `tripId` là số (ví dụ `123`); tham số URL được chuyển sang số trước khi xử lý. Chuyến xe không còn trường `code`. Migration `20261009040000_numeric_trip_id` bỏ cột này và giữ nguyên ID, quan hệ vé/giữ ghế và các mã PNR đã lưu. Với database hiện có, chạy `npm run db:upgrade` để sao lưu trước khi áp dụng migration, sau đó chạy `npx prisma generate` và khởi động lại ứng dụng.

Nếu database import đã có sức chứa và nghiệp vụ vé mới nhưng vẫn giữ cột `trip.code` bắt buộc, thao tác tạo chuyến sẽ thất bại dù form hợp lệ. Chạy `npm run db:trips` để sửa riêng phần lệch này. Lệnh kiểm tra schema/phụ thuộc, sao lưu toàn bộ bảng `trip` cùng ánh xạ ID–mã cũ vào `.local-backups/`, rồi bỏ cột `code`; không đổi ID, vé, PNR hoặc lịch sử migration. Chạy lại là no-op. Lệnh này không thay thế toàn bộ `db:upgrade`.

Sức chứa được lưu tại `bus.capacity`; mỗi chuyến bắt buộc có `trip.busId` tham chiếu xe. Khi tạo/sửa chuyến trong `/admin/trips`, chọn xe để lấy sức chứa; server tự tính ghế trống. Kiểm tra kế hoạch chuyển dữ liệu cũ bằng `node scripts/setup-trip-buses.cjs --check --sample-buses`. Cách sao lưu, áp dụng, dữ liệu xe mẫu và quy tắc đổi xe: [hướng dẫn chuyển đổi xe–chuyến](documentation/trip-bus-migration.md).

Mở `http://localhost:3000`. Tài khoản quản trị cần có role `ADMIN` trong database.

Nếu cần dữ liệu mẫu, thiết lập biến môi trường `SEED_PASSWORD` (6–128 ký tự) rồi chạy `npx prisma db seed`. Seed chỉ chạy trên database hoàn toàn trống, lưu mật khẩu đã hash và không xóa dữ liệu hiện có. Tài khoản ADMIN mẫu dùng số điện thoại `0987654321` với mật khẩu bạn đã thiết lập.

## Thanh toán online thử nghiệm

Thanh toán bằng VietQR Quick Link: QR điền sẵn ngân hàng, tài khoản, tổng tiền và mã đơn hàng. Khi bật `PAYMENT_DEMO_ENABLED`, nút “Tôi đã chuyển khoản” tạo giao dịch giả lập và hoàn tất vé; quản trị xem tại `/admin/payments`. Không cần API key, SDK hay webhook. Cấu hình tài khoản nhận tiền và giải thích code tại [PAYMENT.md](PAYMENT.md). Xác nhận Demo không kiểm chứng tiền đã vào ngân hàng.

## Kiểm tra và build

```sh
npm run lint
npm run typecheck
npm test
npm run test:admin-db
npm run build
npm start
```

`npm start` chạy bản production đã tạo bằng `npm run build`. `npm test` chạy test độc lập với database. `npm run test:admin-db` tạo database tạm, kiểm tra nghiệp vụ với MySQL/MariaDB thật rồi xóa riêng database tạm đó. Người dùng database cần quyền CREATE DATABASE và DROP DATABASE để chạy lệnh kiểm tra này.

Nếu môi trường Windows/sandbox chặn test runner tạo tiến trình con (`spawn EPERM`), chạy `npm test` trong môi trường cho phép tiến trình con. Bộ test đầy đủ cần cách ly từng file vì có fixture thay đổi biến môi trường và module cache. `security:check` chỉ chạy nhóm kiểm tra đã xác minh tương thích cùng tiến trình; không thay thế toàn bộ unit test, kiểm thử database hoặc trình duyệt.

`node tests/booking-fixes-db.cjs` kiểm tra riêng migration tiền nguyên đồng và các luồng guest, tra cứu, giữ ghế, quản lý vé, tìm chuyến trên database tạm rồi xóa database đó. Kiểm tra này dùng schema hiện tại, không thay thế việc kiểm tra toàn bộ lịch sử migration trong `test:admin-db`.

Sau khi build, trên Windows có Google Chrome, chạy `node --test tests/booking-fixes.browser.cjs` để kiểm tra hai phiên trình duyệt độc lập: cookie chọn ghế, chặn giả mạo ID, đặt/hủy ghế và khôi phục sau mất mạng. Test tự tạo server, database và profile Chrome tạm rồi dọn riêng các tài nguyên đó; không cần cài Playwright.

Trên MySQL hiện tại, `test:admin-db` gặp lỗi 3823 ở migration cũ `20261009010000_admin_business_rules`: CHECK `booking_active_seat_check` tham chiếu cột đang dùng trong khóa ngoại có CASCADE. Cần xử lý tương thích lịch sử migration trước khi dùng `db:upgrade` trên máy này; các migration đã áp dụng không được tự sửa checksum. Kiểm thử các sửa lỗi mới dùng database tạm độc lập, không thay đổi database ứng dụng.

Chạy `npm run test:booking-concurrency` để gửi hai yêu cầu đặt cùng ghế qua HTTP tới Next.js và MySQL thật. Lệnh tạo database demo mới riêng, lưu request/response và dữ liệu trước–sau vào `documentation/evidence/booking-concurrency/`, rồi dừng server thử; database được giữ lại để đối chiếu. Cách chạy, SQL chỉ đọc và nội dung dùng cho mục 5.3.4 của báo cáo: [Minh chứng kiểm thử đặt vé đồng thời](documentation/reports/chapter5/README.md).

`npm run test:finance-db` tạo database tạm riêng để kiểm tra sổ thu/hoàn, nâng cấp dữ liệu cũ, thu/hoàn đồng thời, trùng lịch phân công và bảo vệ ghế đang giữ. Lệnh xóa riêng database kiểm thử khi kết thúc. Không sửa checksum migration đã áp dụng.

## Tìm code ở đâu

- `app/`: trang và API.
- `components/`: giao diện được chia theo tính năng.
- `hooks/`: state của danh sách, bộ lọc, tải dữ liệu và hành động bất đồng bộ.
- `services/*Service.ts`: truy vấn database phía server; `services/client*Service.ts`: gọi API từ trình duyệt.
- `lib/api-client.ts`: xử lý HTTP và thông báo lỗi dùng chung.
- `lib/validations/`: schema Zod kiểm tra dữ liệu nhập.
- `lib/record-mappers.ts`: chuyển bản ghi database thành dữ liệu trả về cho giao diện.
- `types/`: kiểu dữ liệu dùng chung; `prisma/`: schema, migration và seed; `tests/`: test hồi quy.

Màu thương hiệu và font được cấu hình trong `app/globals.css` và `app/layout.tsx`. Các tuyến và giá vé trên trang chủ lấy từ database; ảnh và nội dung gợi ý du lịch nằm trong `components/home/content.tsx` và `lib/home-content.ts`.


## Nghiệp vụ admin

- ADMIN đang hoạt động mới truy cập được trang và API quản trị. Có nút đăng xuất, bảo vệ tài khoản đang đăng nhập và quản trị viên hoạt động cuối cùng.
- Tài khoản USER là hồ sơ người mua vé; CUSTOMER là khách đã đăng ký có hồ sơ email. Chỉnh sửa CUSTOMER đồng bộ tên, điện thoại và trạng thái với bảng customer. Khóa tài khoản giữ lịch sử vé và vô hiệu hóa các phiên đăng nhập hiện có.
- Hồ sơ nhân viên quản lý thông tin nhân sự, không tự tạo tài khoản đăng nhập. Tạo tài khoản quản trị tại mục Tài khoản.
- Xe lưu sức chứa tại `bus.capacity` (1–60); chuyến liên kết bằng `busId`, không lưu thêm `trip.capacity`. Ghế trống = sức chứa xe − số vé CONFIRMED/PENDING; admin chọn xe, không nhập sức chứa hoặc ghế trống trong form chuyến. API chuyến có thể trả `capacity` hoặc `totalSeats` được tính từ xe để hiển thị sơ đồ.
- Xe đã được gán cho chuyến không được xóa hoặc thay đổi sức chứa. Khi có ghế đang giữ còn hạn, chưa được đổi xe. Chuyến có lịch sử vé chỉ đổi sang xe cùng sức chứa; chuyến chưa có lịch sử vé và không có giữ ghế còn hạn có thể đổi sang xe khác sức chứa, server tính lại ghế trống. Xe mới chọn phải đang hoạt động.
- Chuyến đã có vé hiệu lực không đổi hành trình/giờ xuất bến. Giá mới chỉ áp dụng cho vé tạo sau đó. Chuyến và tài khoản có lịch sử vé không bị xóa.
- Vé online bắt đầu PENDING. Vé tại quầy chọn PENDING hoặc CONFIRMED theo việc thu tiền. Mỗi lượt tối đa 5 ghế, cùng mã PNR; tên và điện thoại hành khách được lưu riêng với tài khoản.
- Hủy vé trả lại ghế đúng một lần và giữ lịch sử thu tiền; khoản cần hoàn được ghi riêng. Khôi phục chỉ khi chuyến đang mở bán, chưa xuất bến, ghế thuộc sơ đồ hiện tại và chưa bị đặt/giữ. DELETE vé cũng là hủy có giữ lịch sử. Nhân viên xác nhận khoản hoàn riêng sau khi hoàn tiền thực tế.
- Doanh thu dựa trên khoản thu trừ khoản hoàn đã ghi nhận; hủy vé chưa hoàn tiền vẫn giữ khoản thu. Báo cáo tiền thực loại giao dịch DEMO. Với vé cũ, migration giữ ngày xác nhận thu tiền hoặc ngày tạo nếu chưa có ngày xác nhận. Thống kê tại các danh sách áp dụng cùng bộ lọc với bảng; ngày/tháng tính theo giờ Việt Nam.
- Database có khóa duy nhất cho ghế hiệu lực và khóa ngoại bảo vệ lịch sử. Chuyển đổi xe–chuyến bổ sung CHECK sức chứa xe và giới hạn ghế trống; quan hệ ghế trống với sức chứa xe được kiểm tra trong service. Các thao tác đặt, hủy, khôi phục và đổi xe dùng transaction Serializable.

## Tra cứu, tài khoản và tìm chuyến

- Tra cứu công khai yêu cầu cả PNR và số điện thoại hành khách khớp chính xác, giới hạn 20 lượt/phút/số điện thoại và 60 lượt/phút/nguồn. Giới hạn chạy trong từng tiến trình Node; triển khai nhiều worker cần bộ đếm dùng chung và proxy quản lý địa chỉ nguồn. Lịch sử `/bookings` chỉ hiển thị vé thuộc tài khoản đang đăng nhập.
- Đặt vé vãng lai không đăng ký số điện thoại hành khách thành tài khoản. Khi đăng ký bằng số từng dùng mua vé, tài khoản mới không tự nhận lịch sử vé cũ; khách vẫn tra cứu bằng PNR và số điện thoại.
- Tìm chuyến chỉ trả chuyến chưa xuất bến và còn ghế. Bộ lọc giờ dùng giờ Việt Nam; bộ lọc loại xe dựa trên `bus.type` của xe được gán. Bộ lọc và phân trang được giữ trong URL.
- API chuyến công khai hỗ trợ phân trang; chế độ quản trị yêu cầu `admin=true` và xác thực ADMIN.
- Realtime chọn ghế dùng cookie HttpOnly để kiểm tra quyền thao tác; mã client trong sự kiện công khai không phải token quyền sở hữu. Trạng thái ghế đã đặt được tải lại khi kết nối và sau thay đổi đặt/hủy vé.
