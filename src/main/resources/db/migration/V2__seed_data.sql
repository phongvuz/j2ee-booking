-- ============================================================
-- DỮ LIỆU MẪU (SEED DATA - Khớp với mock data bên Frontend)
-- ============================================================
-- LƯU Ý: ngày đi của các chuyến mẫu = CURRENT_DATE + 7 (tính lúc chạy migration lần đầu).

-- Users (Lưu ý: thay password_hash bằng BCrypt hash thực tế khi chạy Spring Security)
INSERT INTO users (username, password_hash, role) VALUES
('admin',    '$2a$10$exampleBcryptHashForAdmin123456789012345678901234', 'ADMIN'),
('client01', '$2a$10$exampleBcryptHashForClient12345678901234567890123', 'CLIENT'),
('client02', '$2a$10$exampleBcryptHashForClient22345678901234567890123', 'CLIENT');

-- Buses
INSERT INTO buses (bus_code, plate_number, type, seat_count, status) VALUES
('BUS-001', '51B-123.45', 'Limousine 22 phòng', 22, 'ACTIVE'),
('BUS-002', '51B-987.65', 'Giường nằm 34 chỗ',  34, 'ACTIVE'),
('BUS-003', '51B-456.78', 'Giường nằm 34 chỗ',  34, 'MAINTENANCE'),
('BUS-004', '51B-333.33', 'Limousine 22 phòng', 22, 'ACTIVE'),
('BUS-005', '49B-111.11', 'Giường nằm 34 chỗ',  34, 'INACTIVE');

-- Trips (empty_seats = seat_count - số ghế đã đặt trong order_seats)
INSERT INTO trips (trip_code, bus_id, departure, destination, departure_date, departure_time, price, empty_seats) VALUES
('VN01', 1, 'SGN', 'DLT', CURRENT_DATE + 7, '21:00:00', 300000.00, 20),
('VN02', 2, 'SGN', 'HAN', CURRENT_DATE + 7, '22:30:00', 250000.00, 34),
('VN03', 4, 'SGN', 'NHA', CURRENT_DATE + 7, '22:30:00', 250000.00, 21);

-- Orders (id 1, 2, 3 theo thứ tự chèn; user_id: 2 = client01, 3 = client02)
INSERT INTO orders (pnr_code, customer_name, customer_phone, trip_id, user_id, total_price, status, booking_date) VALUES
('NHAXE-1A2B3C', 'Nguyễn Văn A', '0901112223', 1, 2, 600000.00, 'PAID',      CURRENT_TIMESTAMP - INTERVAL '1 day'),
('NHAXE-X9Y8Z7', 'Trần Thị B',   '0912223334', 3, 3, 250000.00, 'PENDING',   CURRENT_TIMESTAMP),
('NHAXE-C4N5L6', 'Lê Văn C',     '0923334445', 2, 2, 250000.00, 'CANCELLED', CURRENT_TIMESTAMP - INTERVAL '2 day');

-- Order seats (đơn CANCELLED không giữ ghế)
INSERT INTO order_seats (order_id, trip_id, seat_code) VALUES
(1, 1, '1A1'),
(1, 1, '1A2'),
(2, 3, '2B3');

-- Employees
INSERT INTO employees (emp_code, name, role, phone, status) VALUES
('EMP-001', 'Nguyễn Văn A', 'Tài xế',    '0901234567', 'WORKING'),
('EMP-002', 'Trần Thị B',   'Văn phòng', '0912345678', 'WORKING'),
('EMP-003', 'Lê Hoàng C',   'Phụ xe',    '0923456789', 'ON_LEAVE'),
('EMP-004', 'Phạm Văn D',   'Tài xế',    '0934567890', 'WORKING'),
('EMP-005', 'Hoàng Thị E',  'Quản lý',   '0945678901', 'WORKING');

-- Bus - Employees (Phân công tài xế/phụ xe cho xe)
INSERT INTO bus_employees (bus_id, employee_id) VALUES
(1, 1),
(1, 3),
(2, 4);
