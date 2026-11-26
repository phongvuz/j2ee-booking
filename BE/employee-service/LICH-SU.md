# Lịch sử xây dựng Employee Service

Sau mỗi bước đã hoàn thành, thêm mục mới gồm mục tiêu, file đã tạo hoặc sửa, lý do thay đổi, hệ quả nếu thiếu và kết quả kiểm tra.

## Bước 1 — Khởi tạo dự án Spring Boot

Mục tiêu là tạo một service backend có thể biên dịch và khởi động độc lập bằng Maven.

| Thao tác | File | Lý do và hệ quả nếu thiếu |
| --- | --- | --- |
| Tạo | [pom.xml](pom.xml) | Khai báo Java 21, Spring Boot 4.1.1, Spring Web MVC và plugin Spring Boot. Maven cần POM để nhận diện dự án, tải thư viện và chạy lệnh build. Nếu thiếu POM, Maven báo lỗi khi chạy `mvn spring-boot:run` trong thư mục service. |
| Tạo | [EmployeeServiceApplication.java](src/main/java/com/booking/employee/EmployeeServiceApplication.java) | Chứa hàm `main` và `@SpringBootApplication` để chạy ứng dụng. Nếu thiếu lớp này, `mvn spring-boot:run` không tìm được lớp chính. |

**Kiểm tra.** Service khởi động thành công. `GET /` trả `404` vì chưa có route. Chưa xác minh đóng gói JAR vì môi trường thiếu thư viện trong bộ nhớ đệm và không truy cập được Maven Central.

## Bước 2 — Ánh xạ Employee và kết nối PostgreSQL

Mục tiêu là dùng Spring Data JPA với bảng `employees` đã định nghĩa trong [script-db.txt](../../script-db.txt).

| Thao tác | File | Lý do và hệ quả nếu thiếu |
| --- | --- | --- |
| Sửa | [pom.xml](pom.xml) | Thêm Spring Data JPA cho Hibernate và repository, thêm driver JDBC để kết nối PostgreSQL. Thiếu JPA thì các lớp dùng `jakarta.persistence` và `JpaRepository` không biên dịch được. Thiếu driver thì ứng dụng không mở được kết nối PostgreSQL. |
| Tạo | [Employee.java](src/main/java/com/booking/employee/model/Employee.java) | Ánh xạ hồ sơ Java vào bảng `employees`, gồm ID do PostgreSQL sinh và các cột `emp_code`, `name`, `role`, `phone`, `status`. Nếu thiếu lớp này, `EmployeeRepository` không biên dịch được. |
| Tạo | [EmployeeStatus.java](src/main/java/com/booking/employee/model/EmployeeStatus.java) | Giới hạn trạng thái Java theo ba giá trị trong SQL là `WORKING`, `ON_LEAVE` và `RESIGNED`. Nhân viên mới mặc định `WORKING` trong `Employee.java`. Nếu thiếu enum, `Employee.java` không biên dịch được. |
| Tạo | [EmployeeRepository.java](src/main/java/com/booking/employee/repository/EmployeeRepository.java) | Cho Spring Data JPA cung cấp `findAll()`, `findById()` và `save()`. Ứng dụng hiện vẫn khởi động được nếu bỏ file này. Tầng nghiệp vụ sẽ không biên dịch khi tham chiếu đến repository đã bị bỏ. |
| Tạo | [application.yml](src/main/resources/application.yml) | Bật `ddl-auto: validate` để phát hiện thiếu bảng hoặc sai kiểu cột lúc khởi động, đồng thời tắt `open-in-view` để tầng web không giữ phiên truy cập dữ liệu. Nếu thiếu file, lỗi cấu trúc bảng có thể chỉ lộ ra khi truy vấn. |
| Chuyển vị trí | [EmployeeServiceApplication.java](src/main/java/com/booking/employee/EmployeeServiceApplication.java) | Đưa lớp khởi động từ `src/main/resources/java` về `src/main/java`. Maven biên dịch Java từ `src/main/java`. Nếu để ở `resources`, bản build sạch chỉ sao chép file nguồn và không sinh lớp khởi động. |

**Cấu hình kết nối.** Spring Boot đọc `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME` và `SPRING_DATASOURCE_PASSWORD` từ môi trường.

**Kiểm tra.** Đã khởi động service với PostgreSQL 18.3 tạm, nạp schema từ `script-db.txt` và xác minh Hibernate kiểm tra bảng thành công. Lần chạy thử dùng driver JDBC `42.7.11` có sẵn trong máy. POM dùng phiên bản do Spring Boot quản lý.

## Bước 3 — Triển khai API quản lý nhân viên

| API | Kết quả |
| --- | --- |
| `GET /employees` | `200` và danh sách nhân viên, gồm cả hồ sơ đã nghỉ việc. |
| `POST /employees` | `201` và hồ sơ mới có trạng thái `WORKING`. |
| `PUT /employees/{id}` | `200` và hồ sơ đã cập nhật. Trạng thái làm việc được giữ nguyên. |
| `DELETE /employees/{id}` | `204` sau khi chuyển hồ sơ sang `RESIGNED`. Gọi lại vẫn trả `204`. |

`POST` và `PUT` nhận JSON gồm `msnv`, `name`, `role` và `phone`. API trả `400` khi dữ liệu không hợp lệ, `404` khi ID không tồn tại và `409` khi trùng mã nhân viên hoặc số điện thoại.

| Thao tác | File | Lý do và hệ quả nếu thiếu |
| --- | --- | --- |
| Tạo | [EmployeeController.java](src/main/java/com/booking/employee/controller/EmployeeController.java) | Gắn các phương thức HTTP vào `/employees`. Nếu bỏ controller, các route này trả `404`. |
| Tạo | [EmployeeRequest.java](src/main/java/com/booking/employee/dto/EmployeeRequest.java) | Định nghĩa bốn trường đầu vào và kiểm tra nội dung, độ dài theo schema trước khi lưu. Nếu bỏ file, controller và service không biên dịch. Nếu bỏ phần kiểm tra, dữ liệu sai có thể lọt đến cơ sở dữ liệu hoặc được lưu, tùy ràng buộc của cột. |
| Tạo | [EmployeeService.java](src/main/java/com/booking/employee/service/EmployeeService.java) | Điều phối truy vấn, lưu, sửa và chuyển trạng thái. Giao dịch giữ khóa đến khi sửa hoặc cho nghỉ việc xong. Lỗi trùng khóa từ PostgreSQL được chuyển thành `409`. Nếu thiếu service, controller không biên dịch. |
| Sửa | [Employee.java](src/main/java/com/booking/employee/model/Employee.java) | Thêm `updateProfile()` và `resign()` để chỉnh hồ sơ và trạng thái theo hai thao tác riêng. Nếu thiếu các phương thức này, service không biên dịch. |
| Sửa | [EmployeeRepository.java](src/main/java/com/booking/employee/repository/EmployeeRepository.java) | Thêm truy vấn khóa bản ghi khi sửa hoặc cho nghỉ việc. Nếu bỏ riêng khóa, hai yêu cầu đồng thời có thể ghi đè trạng thái `RESIGNED` bằng trạng thái cũ. |
| Sửa | [application.yml](src/main/resources/application.yml) | Mặc định chỉ lắng nghe ở `127.0.0.1` trong giai đoạn triển khai API và bật phản hồi lỗi JSON chuẩn. Nếu bỏ hai thiết lập mới, service có thể lắng nghe trên mọi giao diện mạng và lỗi có thể mất thông tin chi tiết chuẩn. |
| Tạo | [employee-api-smoke.ps1](tests/employee-api-smoke.ps1) | Kiểm tra bốn API qua HTTP với PostgreSQL tạm. Nếu thiếu file, cần kiểm tra lại các trường hợp này thủ công. |
| Sửa | [LICH-SU.md](LICH-SU.md) | Ghi kết quả và lý do thay đổi của bước 3 để thành viên khác theo dõi. |

**Kiểm tra.** Script đã chạy đạt trên PostgreSQL 18.3 tạm với JDBC `42.7.11`. Các ca gồm dữ liệu rỗng hoặc quá dài, mã và số điện thoại trùng, ID không tồn tại, sửa hồ sơ, cho nghỉ việc hai lần và kiểm tra hồ sơ vẫn còn trong danh sách. Chạy lại bằng PowerShell 7 từ thư mục `BE/employee-service` khi service đang kết nối cơ sở dữ liệu tạm.

```powershell
pwsh -File tests/employee-api-smoke.ps1 -BaseUrl http://127.0.0.1:8080
```

**Phạm vi ở bước 3.** API chạy thử cục bộ. Quy tắc xử lý tài xế còn chuyến sắp chạy cần thống nhất với Trip Service trước khi tích hợp.

### Điều chỉnh bước 3 — Dùng `msnv`

Đổi trường `empCode` thành `msnv` trong JSON gửi lên và trả về. Ví dụ `"msnv": "NV001"`. Mã vẫn bắt buộc, tối đa 20 ký tự, duy nhất và lưu vào cột `emp_code` để tương thích với dữ liệu hiện có.

| Thao tác | File | Lý do và hệ quả nếu bỏ thay đổi |
| --- | --- | --- |
| Sửa | [EmployeeRequest.java](src/main/java/com/booking/employee/dto/EmployeeRequest.java) | Đọc `msnv` từ JSON và dùng tên này trong lỗi `400`. Tên cũ khiến service không tìm được accessor `msnv()`. |
| Sửa | [Employee.java](src/main/java/com/booking/employee/model/Employee.java) | Dùng `getMsnv()` để trả `msnv` qua API, đồng thời ánh xạ vào cột `emp_code`. Getter cũ khiến phản hồi trả tên trường cũ. |
| Sửa | [EmployeeService.java](src/main/java/com/booking/employee/service/EmployeeService.java) | Lấy mã qua `request.msnv()` khi tạo hoặc sửa hồ sơ. Lời gọi accessor cũ gây lỗi biên dịch. |
| Sửa | [employee-api-smoke.ps1](tests/employee-api-smoke.ps1) | Gửi và kiểm tra `msnv` khi tạo, sửa và liệt kê. Payload cũ thiếu `msnv` và nhận `400`. |
| Sửa | [LICH-SU.md](LICH-SU.md) | Cập nhật tên trường trong hướng dẫn API và ghi lại thay đổi. |

**Kiểm tra.** Script đã chạy đạt trên PostgreSQL tạm, gồm tạo và đổi `msnv`, đọc lại mã sau khi lưu, từ chối mã trùng và báo đúng trường khi thiếu `msnv`.

## Bước 4 — Áp dụng quyền ADMIN trên API Employee Service

Theo [file phân tích](../../phan-tich-du-an-dat-ve-xe.md), thành viên 4 phụ trách đăng nhập và cấp JWT. Thành viên 3 kiểm tra JWT và áp dụng quyền trên bốn API nhân viên của mình.

| Yêu cầu đến `/employees` | Kết quả |
| --- | --- |
| Thiếu Bearer token hoặc JWT không hợp lệ | `401 Unauthorized`. |
| JWT hợp lệ của `CLIENT` hoặc `STAFF` | `403 Forbidden`. |
| JWT hợp lệ với `role` là `ADMIN` | Chuyển đến controller xử lý nghiệp vụ. |

| Thao tác | File | Lý do và hệ quả nếu thiếu |
| --- | --- | --- |
| Tạo | [SecurityConfig.java](src/main/java/com/booking/employee/config/SecurityConfig.java) | Dùng Spring Security kiểm tra chữ ký JWT, bên cấp, đối tượng nhận và thời hạn. Chỉ ánh xạ `role: ADMIN` thành quyền quản lý nhân viên. Nếu thiếu file, service mất quy tắc Bearer JWT và phân quyền `ADMIN` dành riêng cho các API này. |
| Sửa | [pom.xml](pom.xml) | Thêm starter OAuth2 Resource Server để Spring nhận và xác thực Bearer JWT. Nếu thiếu dependency, `SecurityConfig.java` không biên dịch được. |
| Sửa | [application.yml](src/main/resources/application.yml) | Đọc thông tin bên cấp JWT, URL bộ khóa công khai và đối tượng nhận từ môi trường. Nếu thiếu biến bên cấp hoặc URL bộ khóa, service không khởi động vì thiếu cấu hình xác thực. |
| Sửa | [employee-api-smoke.ps1](tests/employee-api-smoke.ps1) | Kiểm tra `401` và `403` trên cả bốn API trước khi chạy các ca nghiệp vụ bằng token `ADMIN`. Nếu dùng script trước bước 4, các yêu cầu nghiệp vụ thiếu token sẽ nhận `401`. |
| Sửa | [LICH-SU.md](LICH-SU.md) | Ghi phạm vi thành viên 3, cấu hình cần khi tích hợp và kết quả kiểm thử. |

**Hợp đồng JWT đề xuất để tích hợp.** JWT ký bằng `RS256`, có `iss`, `sub`, `aud`, `exp` và `role`. Đặt `EMPLOYEE_JWT_ISSUER` theo giá trị `iss`, `EMPLOYEE_JWT_JWKS_URI` theo URL bộ khóa công khai của Auth Service và `EMPLOYEE_JWT_AUDIENCE` theo `aud` đã thống nhất. Giá trị mặc định của audience là `employee-service`. Đây là cấu hình phía Employee Service cần đối chiếu với thành viên 4 khi Auth Service sẵn sàng.

**Kiểm tra.** `mvn package` thành công. Đã chạy JAR với PostgreSQL 18.3 và bộ khóa JWT tạm. Kiểm thử đạt cho `ADMIN`, `STAFF`, `CLIENT`, yêu cầu thiếu token, chữ ký sai, token hết hạn, sai `iss` hoặc `aud`, và thiếu `sub` hoặc `exp`. Để chạy lại script từ `BE/employee-service` trên cơ sở dữ liệu tạm, đặt `EMPLOYEE_TEST_ADMIN_TOKEN`, `EMPLOYEE_TEST_STAFF_TOKEN` và `EMPLOYEE_TEST_CLIENT_TOKEN` bằng ba JWT thử tương ứng.

```powershell
pwsh -File tests/employee-api-smoke.ps1 -BaseUrl http://127.0.0.1:8080
```

### Bổ sung bước 4 — Token thử cho Postman

| Thao tác | File | Lý do và hệ quả nếu thiếu |
| --- | --- | --- |
| Tạo | [postman-jwt-fixture.cjs](tests/postman-jwt-fixture.cjs) | Tạo khóa tạm, in JWT thử cho ba quyền và phục vụ khóa công khai tại `127.0.0.1:8091`. Dùng để kiểm tra CRUD và phân quyền khi Auth Service chưa sẵn sàng. Thiếu file thì cần JWT và JWKS từ Auth Service hoặc bộ dữ liệu thử khác. |
| Sửa | [LICH-SU.md](LICH-SU.md) | Ghi cách dùng token thử và kết quả kiểm tra. |

Chạy `node tests/postman-jwt-fixture.cjs` từ `BE/employee-service` và giữ tiến trình mở. Đặt `EMPLOYEE_JWT_ISSUER=http://127.0.0.1:8091`, `EMPLOYEE_JWT_JWKS_URI=http://127.0.0.1:8091/jwks.json` và `EMPLOYEE_JWT_AUDIENCE=employee-service` cho Employee Service. Dán JWT thử vào mục **Authorization → Bearer Token** trong Postman. Token hết hạn sau 30 phút.

**Kiểm tra.** Bộ token thử đã chạy đạt toàn bộ `employee-api-smoke.ps1` trên JAR và PostgreSQL tạm.
