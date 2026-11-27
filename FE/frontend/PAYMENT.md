# Thanh toán VietQR và xác nhận Demo

Trang thanh toán tải ảnh từ API Quick Link miễn phí của VietQR.io, không cần API key, SDK hay webhook. Trình duyệt gọi API khi tải ảnh `<img src="...">`:

```text
https://img.vietqr.io/image/BANK_ID-ACCOUNT_NO-compact2.png?amount=TOTAL_AMOUNT&addInfo=ORDER_CODE&accountName=ACCOUNT_NAME
```

Số tiền `total_amount` là tổng giá các vé cùng mã PNR, đọc từ database. `order_code` có dạng `VE123`: ID vé đầu tiên trong lượt đặt giúp mã đơn hàng ngắn và duy nhất. Mã này là nội dung chuyển khoản hiển thị cạnh QR; PNR vẫn dùng để tra cứu lượt đặt chỗ. Giữ số tài khoản dưới dạng chuỗi để không mất số 0 ở đầu.

## Chạy tại máy cá nhân

Thêm các giá trị của bạn vào `.env`:

```dotenv
VIETQR_BANK_ID="970436"
VIETQR_BANK_NAME="Vietcombank"
VIETQR_ACCOUNT_NO="SO_TAI_KHOAN_CUA_BAN"
VIETQR_ACCOUNT_NAME="TEN_CHU_TAI_KHOAN"
PAYMENT_DEMO_ENABLED="true"
```

`970436` là BIN Vietcombank. Các tài khoản và tên thật được cấu hình trong `.env` riêng, không đưa lên Git. Không cần `APP_URL`, mã Merchant hoặc khóa VNPAY. Không cần public domain hay tunnel, chạy được tại localhost.

Schema của project định nghĩa bảng `Payment`, nhưng database đã import có thể chưa có bảng này. Nếu trang `/success?pnr=...` báo lỗi `The table payment does not exist`, chạy:

```sh
npm run db:payments
```

Lệnh tạo riêng bảng `Payment` từ migration có sẵn, giữ nguyên các vé và dữ liệu khác. Có thể chạy lại; nếu bảng đã tồn tại, lệnh kiểm tra cấu trúc mà không tạo lại hoặc xóa giao dịch. Lệnh này dùng được cho database import chưa có lịch sử migration. Cần cấu hình các biến VietQR bên trên để trang hiển thị QR.

Nếu cài đặt trên máy mới bằng luồng migration, dừng server rồi chạy:

```sh
npm run db:upgrade
npx prisma generate
npm run dev
```

Khi chỉ sửa `.env` hoặc code mà database đã cập nhật, khởi động lại `npm run dev` là đủ.

1. Chọn chuyến chưa xuất bến, đặt ghế và nhập thông tin hành khách.
2. Trang `/success?pnr=...` hiển thị QR, ngân hàng, số tài khoản, tên người nhận, số tiền và mã đơn hàng.
3. Bấm **Tôi đã chuyển khoản**. Backend giả lập nhận tiền, tạo một record trong bảng `Payment` và chuyển tất cả vé cùng PNR sang `CONFIRMED` trong cùng transaction.
4. Xem kết quả tại `/bookings` và `/admin/payments`. Giao dịch giả lập có nhãn **VietQR · Demo**, `responseCode = DEMO`, mã giao dịch bắt đầu `DEMO-`.

Không cần chuyển tiền để thử nút. QR chứa tài khoản ngân hàng thật; nếu xác nhận chuyển khoản trong ứng dụng ngân hàng thì có thể chuyển tiền thật. VietQR chỉ tạo QR, không báo rằng tiền đã vào tài khoản. Tên chủ tài khoản trên ảnh được điền theo cấu hình, không phải kết quả kiểm chứng tên từ ngân hàng.

## Code đơn giản nằm ở đâu

| File | Chức năng |
| --- | --- |
| `lib/vietqr.ts` | Đọc cấu hình, tạo URL ảnh QR bằng `URLSearchParams` |
| `services/paymentService.ts` | Tính tổng vé, mã đơn hàng, tạo payment và xác nhận vé |
| `components/payments/PaymentPanel.tsx` | Hiển thị QR và nút “Tôi đã chuyển khoản” |
| `app/api/payments/demo/confirm/route.ts` | Nhận PNR và gọi hàm xác nhận giả lập |
| `app/(client)/success/page.tsx` | Đọc thông tin vé thật và dữ liệu QR phía server |
| `app/admin/payments/page.tsx` | Xem giao dịch, phân biệt Demo với lịch sử cổng cũ |

Tải trang hoặc QR chưa tạo payment. Chỉ khi bấm nút mới tạo record. Frontend chỉ gửi PNR, không gửi số tiền hoặc trạng thái. Bấm lại hoặc hai yêu cầu đồng thời đều không tạo payment trùng. Vé hủy hoặc chuyến đã xuất bến không được xác nhận. Ghế đã bị trừ khi đặt chỗ nên không trừ tiếp khi thanh toán.

## Chế độ demo

Backend chỉ cho phép giả lập khi `PAYMENT_DEMO_ENABLED="true"`, kể cả khi người dùng tự gọi API. Đặt `false` để tắt nút và chặn xác nhận giả lập; nhân viên phải đối chiếu tiền thực nhận trước khi xác nhận vé qua nghiệp vụ quầy. Bản này không có chức năng tự kiểm tra giao dịch ngân hàng hay tự hoàn tiền.

Vé demo được xác nhận trong database đang dùng và xuất hiện trong doanh thu theo quy tắc hiện tại của project. Dùng database thử khi trình diễn. Lịch sử cổng cũ được giữ, các API VNPAY được thay bằng API demo; không chỉnh lại migration đã áp dụng.

Kiểm tra nghiệp vụ:

```sh
node --test tests/payment.test.cjs
node tests/payment-setup-db.cjs
node tests/payment-db.cjs
npm run lint
npm run typecheck
npm run build
```

Test database tạo và chỉ xóa database tạm có tên `nha_xe_payment_verify_...`, kiểm tra hai yêu cầu đồng thời, vé hủy và tắt demo.

Tài liệu chính thức: [Quick Link](https://www.vietqr.io/en/danh-sach-api/link-tao-ma-nhanh/), [danh sách ngân hàng](https://api.vietqr.io/v2/banks). Tích hợp này sử dụng API công khai của VietQR.io; không tự nhận dịch vụ API là phần mềm mã nguồn mở.
