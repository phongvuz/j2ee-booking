# Bảo mật cơ bản và đối chiếu OWASP Top 10:2025

Tài liệu này phục vụ mục **Bảo mật** trong Phần D của bảng tự kiểm. Phạm vi là nhận biết rủi ro, các kiểm soát thực sự có trong source và phép kiểm tra có thể chạy lại. Đây không phải chứng nhận OWASP/ASVS hoặc kết luận hệ thống không còn lỗ hổng. Bản đối chiếu dùng [OWASP Top 10:2025](https://top10.owasp.org/2025/) và đã kiểm tra nguồn chính thức ngày 06/11/2026; không gán tên hoặc số thứ tự của bản 2021 cho bản 2025.

## Đối chiếu cả mười nhóm rủi ro

Các kiểm thử ghi trong bảng là phạm vi kiểm tra của project, không phải đánh giá bao phủ toàn bộ mỗi nhóm OWASP. Kết quả chạy được lưu riêng tại [evidence/](evidence/).

| Mã và nhóm rủi ro 2025 | Kiểm soát, tệp đối chiếu | Minh chứng có thể chạy | Giới hạn còn lại |
| --- | --- | --- | --- |
| A01 — Broken Access Control | `lib/admin-api.ts` kiểm tra phiên và ADMIN ở API; `lib/session.ts` đọc lại role/trạng thái tài khoản. Lịch sử vé dùng chủ sở hữu từ phiên; tra cứu công khai yêu cầu cả PNR và số điện thoại. `proxy.ts` chặn nguồn lạ trước mutation. | `admin-business.test.cjs`, `auth-session.test.cjs`, `booking-privacy.test.cjs`, `security.test.cjs` | Chưa kiểm toán mọi endpoint/quyền đối tượng trên bản triển khai; bộ test mock không thay thế thử phân quyền HTTP với các tài khoản thật. |
| A02 — Security Misconfiguration | `.env` bị Git ignore; secret đọc ở server. `lib/security-headers.ts` cung cấp `nosniff`, chống iframe, giới hạn referrer/permissions và CSP cơ bản; `next.config.ts` áp dụng headers. CORS không có allowlist bên ngoài hoặc wildcard. | Test proxy/headers và `scripts/check-security-http.cjs` xác minh response thực | Chưa kiểm chứng TLS, hardening reverse proxy, tài khoản DB ít quyền và cấu hình môi trường production. CSP hiện không có `script-src`/nonce. `allowedDevOrigins` chỉ phục vụ dev, không phải CORS production. |
| A03 — Software Supply Chain Failures | `package-lock.json` khóa cây dependency; dùng `npm ci` để cài theo lockfile. | Kiểm tra cài đặt/build theo README | Chưa có kết quả quét dependency/SBOM hoặc chứng thực nguồn artifact trong bộ chứng cứ bảo mật này. Không suy ra dependency an toàn chỉ từ lockfile; cần cập nhật và rà cảnh báo theo thời điểm triển khai. |
| A04 — Cryptographic Failures | `lib/password.ts`: scrypt, salt ngẫu nhiên cho mỗi mật khẩu, so sánh timing-safe. Phiên HMAC-SHA256 dùng `SESSION_SECRET` ít nhất 32 ký tự. Cookie HttpOnly, SameSite=Lax, Secure khi production. | `login.test.cjs`, `register.test.cjs`, `auth-session.test.cjs` | Source hỗ trợ nâng cấp mật khẩu ADMIN import kiểu cũ khi đăng nhập thành công; chưa khẳng định mọi tài khoản cũ đã được nâng cấp. Độ dài secret không chứng minh đủ entropy; người triển khai cần tạo secret ngẫu nhiên và chạy HTTPS. |
| A05 — Injection | API dùng Zod; truy vấn runtime dùng Prisma với dữ liệu/filter có cấu trúc, sort theo whitelist. Giao diện hiển thị tên khách/hành trình bằng biểu thức React để escape HTML. URL VietQR ghép từ host cố định và `URLSearchParams`. | `security.test.cjs` đưa payload SQL vào tìm kiếm/sort và payload HTML vào component thật; test schema hiện có | Phép kiểm tra SQL chỉ xác minh đối số đưa vào Prisma, không chạy payload trên MySQL. Phép kiểm tra XSS xác minh HTML kết xuất ở hai bề mặt; chưa phải thử khai thác mọi DOM sink bằng trình duyệt. Các script migration có raw SQL, không phải đầu vào công khai của API. |
| A06 — Insecure Design | Máy chủ quyết định giá/trạng thái vé, transaction Serializable và unique ghế hiệu lực; giới hạn số ghế, retry, thời hạn vé và giới hạn tra cứu có kiểm soát. | `admin-business.test.cjs`, `booking-lookup-limit.test.cjs`, `payment.test.cjs` | Chưa threat model đầy đủ/kiểm thử tải, lạm dụng và nhiều instance. Giới hạn tra cứu và SSE dùng RAM từng tiến trình. Thanh toán QR + Demo không xác minh tiền thật, không dùng làm đối soát ngân hàng production. |
| A07 — Authentication Failures | Chữ ký phiên, hạn 24 giờ, nonce; kiểm tra lại tài khoản và phiên bản mật khẩu. Login lỗi trả thông báo chung; tài khoản không tồn tại vẫn thực hiện hash work. | `login.test.cjs`, `auth-session.test.cjs` | Chưa MFA, luân chuyển secret/thu hồi tập trung và rate limit đăng nhập phân tán. Không suy ra chống brute force chỉ từ hashing. |
| A08 — Software or Data Integrity Failures | Schema Zod ở biên; phiên có chữ ký; tổng tiền lấy từ DB, không lấy amount do client gửi. Transaction và ràng buộc DB bảo vệ cập nhật nhiều bước. | `register.test.cjs`, `payment.test.cjs`, `admin-business.test.cjs` | Chưa ký artifact phát hành, xác minh provenance hoặc cơ chế webhook ngân hàng có chữ ký. Các kiểm thử mock không chứng minh constraint trên một DB triển khai cụ thể. |
| A09 — Security Logging and Alerting Failures | Có xử lý lỗi phía server và log phục vụ chẩn đoán; lỗi nội bộ được trả thông báo chung ở API. | `security.test.cjs` xác minh lỗi nội bộ không được gửi nguyên văn cho client | Chưa có audit log bảo mật có cấu trúc, cảnh báo đăng nhập bất thường, retention và quy trình phản ứng. `console.error` không thay thế audit log; cần tránh lưu thông tin nhạy cảm khi cấu hình log thực tế. |
| A10 — Mishandling of Exceptional Conditions | `apiError` ánh xạ lỗi nghiệp vụ/Prisma thành mã HTTP, lỗi bất ngờ thành thông báo chung. Transaction retry giới hạn ba lần; hook xử lý mất mạng và khôi phục lựa chọn. | `security.test.cjs`, `admin-business.test.cjs`, `seat-recovery.test.cjs` | Chưa diễn tập lỗi hạ tầng/DoS, giới hạn body tổng quát hoặc chứng minh mọi nhánh lỗi đều fail-closed. Retry có giới hạn không thay cho kế hoạch phục hồi production. |

## Chính sách origin, CORS và CSRF

API dành cho giao diện cùng origin. `proxy.ts` chạy trước `/api/:path*`; các handler vẫn kiểm tra xác thực và quyền của mình. CORS kiểm soát quyền **đọc response của trình duyệt**; nó không tự xác thực người gọi và không thay thế kiểm tra quyền/CSRF. Không endpoint nào được bổ sung `Access-Control-Allow-Origin: *` hoặc phản chiếu Origin.

| Yêu cầu | Hành vi |
| --- | --- |
| Mutation hoặc OPTIONS, Origin khác protocol/host/port; Origin `null`, nhiều Origin hoặc sai dạng | HTTP 403, JSON chung, `Cache-Control: no-store`, không cấp ACAO/credentials |
| Mutation hoặc OPTIONS, `Sec-Fetch-Site: cross-site` hay `same-site`, kể cả thiếu Origin | HTTP 403; subdomain cùng site không được coi là cùng origin |
| Mutation cùng origin | Đi tiếp vào handler; yêu cầu quyền/validation không bị bỏ qua |
| Client không phải trình duyệt, thiếu cả Origin/Fetch Metadata | Được đi tiếp có chủ ý để tương thích công cụ/server client; vẫn phải thỏa xác thực và validation của API |
| GET/HEAD công khai, kể cả SSE | Không chặn tại proxy; response không cấp CORS cho website ngoài. GET không được dùng để tạo mutation nghiệp vụ |
| OPTIONS cùng origin | Đi tới cơ chế OPTIONS của Route Handler; Next trả các method thực sự hỗ trợ |

`Host` dùng để đối chiếu đích mà trình duyệt gọi trong trường hợp Next tạo URL nội bộ khác hostname. Không dùng `x-forwarded-host` do client tự gửi làm origin thay thế. Reverse proxy production phải chuẩn hóa Host/protocol và không cho client truy cập backend ngoài cấu hình tin cậy. Việc cho phép client không có Origin là ngoại lệ được ghi nhận; không tuyên bố guard này xác minh danh tính mọi client hoặc bảo vệ mọi trình duyệt cũ. Tham khảo cách kết hợp [Origin/Fetch Metadata và SameSite của OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

## XSS và CSP được kiểm tra đến đâu

`tests/security.test.cjs` kết xuất component thật với các payload `<img ... onerror>`, `<script>` và `<svg onload>`. Tên khách trong `CustomerMenu` và thông tin vé trong `OrderDetailModal` phải trở thành entity HTML, không tạo thẻ tấn công. JSON API dùng MIME JSON. Không thêm bộ lọc xóa thẻ vào dữ liệu tên người vì validation không thay cho output encoding và có thể làm hỏng dữ liệu hợp lệ. Quy tắc này theo [hướng dẫn XSS của OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html).

CSP hiện chỉ hạn chế base URL, object, frame và form action; không công bố chặn toàn bộ script XSS. Nonce CSP của Next.js 16 yêu cầu nonce theo từng request và xem xét dynamic rendering. Triển khai strict CSP cần một thay đổi riêng, có kiểm tra hydration, script Next, ảnh QR và giao diện trình duyệt. CSP là lớp bổ sung, không thay thế escaping, theo [hướng dẫn CSP của OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html).

## Chạy lại và lưu bằng chứng

Kết quả quan sát ngày **06/11/2026**:

| Phép kiểm tra | Kết quả | Bằng chứng và phạm vi |
| --- | --- | --- |
| Bộ logic/handler mở rộng với lệnh không cách ly bên dưới | 61/61 ca đạt, exit 0 | [logic-check-2026-11-06.json](evidence/logic-check-2026-11-06.json); summary quan sát và hash source, không phải log runner nguyên văn; không dùng DB |
| HTTP trên server dev cô lập tại `127.0.0.1:3001` | 8/8 phép kiểm tra đạt, exit 0 | [http-check-2026-11-06.json](evidence/http-check-2026-11-06.json); lúc 15:04:35 giờ Việt Nam. Xác minh headers thực, GET OpenAPI 200, nguồn lạ/preflight 403, OPTIONS cùng origin 204; không thực hiện ghi DB |

Hai kết quả trên có phạm vi khác nhau: gọi trực tiếp handler với mock và HTTP qua server Next thực. Chưa có bằng chứng khai thác XSS bằng trình duyệt hoặc kiểm toán production trong bộ này.

Kiểm thử logic/handler với Prisma giả lập, không kết nối hoặc sửa DB:

```powershell
npm run security:check
```

Nếu môi trường chặn Node runner tạo subprocess, dùng cấu hình không cách ly đã ghi rõ:

```powershell
node --test --test-isolation=none tests/security.test.cjs tests/request-origin.test.cjs tests/admin-business.test.cjs tests/auth-session.test.cjs tests/login.test.cjs tests/register.test.cjs tests/booking-privacy.test.cjs tests/booking-lookup-limit.test.cjs
```

Sau khi chạy server đã nạp source và cấu hình mới, kiểm tra HTTP headers và origin bằng endpoint OpenAPI không cần đăng nhập hoặc DB:

```powershell
node scripts/check-security-http.cjs http://127.0.0.1:3001
```

Script chỉ GET tài liệu, OPTIONS và gửi POST bị chặn trước handler. Không gửi session, không tạo tài khoản, không chạy login hợp lệ hoặc ghi dữ liệu. Mọi response phải có các header từ helper; phản hồi nguồn lạ phải 403 và không có ACAO, còn tài liệu cùng origin phải đọc được. Phép kiểm tra HTTP này không thử khai thác XSS trong trình duyệt. Không ghi cookie, secret hoặc mật khẩu vào chứng cứ.

Khi mô tả báo cáo, có thể viết: **“Đã bổ sung đối chiếu nhận biết đủ 10 nhóm OWASP Top 10:2025; áp dụng hash mật khẩu, phân quyền, truy vấn Prisma, escaping React và chính sách cùng origin; có kiểm thử và ghi rõ giới hạn.”** Số ca đạt/ngày chạy phải lấy từ đúng file evidence, không lấy số ca cũ của Chương 12 cho source đã thay đổi.
