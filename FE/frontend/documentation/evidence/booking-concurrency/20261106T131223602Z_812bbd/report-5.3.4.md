# 5.3.4. Kết quả kiểm thử hai yêu cầu đặt cùng một ghế

Thời điểm: 20:12:23 6/11/26 (UTC+7, Asia/Bangkok). Database riêng: `sgu_booking_demo_race_1793970743716_3ff0b6`. MySQL 8.0.46; Next.js 16.3.5; Node.js v24.22.1. Thực nghiệm dùng Next.js development server và HTTP thật, không mock handler/service/Prisma.

Mỗi lượt tạo chuyến mới có 22 ghế trống. Hai hành khách có họ tên và số điện thoại khác nhau gửi POST /api/bookings từ cùng một điểm xuất phát của bộ kiểm thử. Mười lượt yêu cầu cùng A01; một lượt yêu cầu hai tập ghế giao nhau tại A01. Trước và sau mỗi lượt, bộ kiểm thử đọc trực tiếp trip, booking, SeatHold và số tài khoản trên MySQL.

| Lượt | Kịch bản | tripId | HTTP A | HTTP B | Số vé sau | Ghế trống trước → sau | Kết quả |
|---|---|---:|---:|---:|---:|---|---|
| 1 | same-seat | 8 | 201 | 409 | 1 | 22 → 21 | PASS |
| 2 | same-seat | 9 | 201 | 409 | 1 | 22 → 21 | PASS |
| 3 | same-seat | 10 | 201 | 409 | 1 | 22 → 21 | PASS |
| 4 | same-seat | 11 | 201 | 409 | 1 | 22 → 21 | PASS |
| 5 | same-seat | 12 | 201 | 409 | 1 | 22 → 21 | PASS |
| 6 | same-seat | 13 | 201 | 409 | 1 | 22 → 21 | PASS |
| 7 | same-seat | 14 | 201 | 409 | 1 | 22 → 21 | PASS |
| 8 | same-seat | 15 | 409 | 201 | 1 | 22 → 21 | PASS |
| 9 | same-seat | 16 | 201 | 409 | 1 | 22 → 21 | PASS |
| 10 | same-seat | 17 | 201 | 409 | 1 | 22 → 21 | PASS |
| 11 | overlapping-multiple-seats | 18 | 409 | 201 | 2 | 22 → 20 | PASS |

Kết quả: 11/11 lượt đạt. Mỗi lượt có đúng một yêu cầu 201 và một yêu cầu 409; chỉ các ghế thuộc yêu cầu thành công được lưu. activeSeat, PNR, hành khách và ID vé khớp phản hồi 201. Số ghế trống giảm đúng số ghế của yêu cầu thành công; yêu cầu thất bại không để lại tài khoản/vé dở dang. Gửi lại yêu cầu thua vẫn trả 409 và không làm thay đổi dữ liệu. Đối chứng đặt lần lượt hai ghế khác nhau đạt PASS.

Giới hạn: khoảng thời gian HTTP chồng lấn không chứng minh hai transaction đọc cùng một thời điểm. Không quan sát thấy dữ liệu ghi dở dang; thực nghiệm không xác định yêu cầu thua đã ghi dữ liệu rồi rollback hay bị từ chối trước khi ghi. Thực nghiệm không cô lập tác dụng của từng cơ chế Serializable, retry hay unique index; không phải phép đo tải hoặc bằng chứng cho mọi lịch thực thi. Database dùng schema snapshot có các CHECK và unique activeSeat, đổi riêng FK booking.tripId sang ON UPDATE RESTRICT để tránh MySQL 3823; không xác minh chuỗi migration lịch sử. Không kiểm thử giữ ghế qua giao diện hoặc thanh toán ngân hàng.

Minh chứng gốc: [result.json](result.json). Tệp này lưu request/response, thời điểm, dữ liệu trước–sau, metadata database và SHA-256 source.
