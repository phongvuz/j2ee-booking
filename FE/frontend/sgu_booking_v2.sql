-- ================================================================
-- SGU BOOKING V2 - HE THONG DAT VE XE KHACH
-- MariaDB 10.4+ (XAMPP) / MySQL 8.0.16+
-- Bang: customer, employee, route, bus, bus_seat, trip,
--       trip_seat, seat_hold, booking_order, booking_ticket, payment
-- KHONG co bang user. Dung password_hash o customer / employee.
-- CHU Y: CHAY LAI FILE SE XOA TOAN BO DB sgu_booking_v2!
-- DB CU `sgu-booking` KHONG BI ANH HUONG.
-- Luu tru thoi gian DATETIME theo gio VN (+07:00) trong demo;
-- ung dung can dung cung quy uoc mui gio, dac biet voi Prisma.
-- Tai khoan mau chi danh cho DEMO; tat ca dung mat khau Demo@12345.
-- Password duoc hash: scrypt(N=16384,r=8,p=1,dkLen=64),
-- dinh dang scrypt:<salt_ascii_hex>:<derived_key_hex>.
-- ================================================================

SET NAMES utf8mb4;
SET time_zone = '+07:00';
DROP DATABASE IF EXISTS sgu_booking_v2;
CREATE DATABASE sgu_booking_v2
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE sgu_booking_v2;

-- 01. Khach hang; password_hash = NULL nghia la ho so khach vang lai
CREATE TABLE customer (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(191) NULL,
    phone VARCHAR(20) NOT NULL,
    password_hash VARCHAR(255) NULL,
    address VARCHAR(255) NULL,
    status ENUM('ACTIVE','LOCKED') NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_customer_email (email),
    UNIQUE KEY uq_customer_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 02. Nhan vien va admin chung bang; DRIVER la nhan vien lai xe
CREATE TABLE employee (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(191) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('ADMIN','STAFF','DRIVER') NOT NULL DEFAULT 'STAFF',
    department VARCHAR(100) NULL,
    driver_license VARCHAR(50) NULL,
    hire_date DATE NULL,
    status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_employee_email (email),
    UNIQUE KEY uq_employee_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 03. Tuyen duong: 1 tuyen co nhieu chuyen
CREATE TABLE route (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    origin VARCHAR(120) NOT NULL,
    destination VARCHAR(120) NOT NULL,
    distance_km DECIMAL(8,2) NULL,
    estimated_duration_min INT UNSIGNED NULL,
    status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_route_origin_destination (origin, destination),
    CONSTRAINT ck_route_distance CHECK (distance_km IS NULL OR distance_km > 0),
    CONSTRAINT ck_route_duration CHECK (estimated_duration_min IS NULL OR estimated_duration_min > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 04. Xe; khong gan co dinh tai xe vao xe, ma gan vao trip
CREATE TABLE bus (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    license_plate VARCHAR(20) NOT NULL,
    bus_type VARCHAR(100) NOT NULL,
    seat_capacity SMALLINT UNSIGNED NOT NULL,
    brand VARCHAR(100) NULL,
    manufacture_year SMALLINT UNSIGNED NULL,
    last_maintenance_date DATE NULL,
    status ENUM('ACTIVE','MAINTENANCE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    notes TEXT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_bus_plate (license_plate),
    CONSTRAINT ck_bus_capacity CHECK (seat_capacity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 05. So do ghe vat ly cua tung xe; UNIQUE (bus_id,seat_number)
CREATE TABLE bus_seat (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    bus_id INT UNSIGNED NOT NULL,
    seat_number VARCHAR(10) NOT NULL,
    deck TINYINT UNSIGNED NOT NULL DEFAULT 1,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    UNIQUE KEY uq_bus_seat (bus_id, seat_number),
    UNIQUE KEY uq_bus_seat_id_bus (id, bus_id),
    KEY idx_bus_seat_active (bus_id, is_active),
    CONSTRAINT fk_bus_seat_bus FOREIGN KEY (bus_id) REFERENCES bus(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT ck_bus_seat_deck CHECK (deck IN (1, 2))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 06. Chuyen xe cu the. Thoi gian di va den; xe va tai xe.
CREATE TABLE trip (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    route_id INT UNSIGNED NOT NULL,
    bus_id INT UNSIGNED NOT NULL,
    driver_employee_id INT UNSIGNED NULL,
    departure_at DATETIME NOT NULL,
    arrival_at DATETIME NOT NULL,
    pickup_point VARCHAR(255) NOT NULL,
    dropoff_point VARCHAR(255) NOT NULL,
    base_price DECIMAL(12,0) NOT NULL,
    status ENUM('SCHEDULED','BOARDING','IN_PROGRESS','COMPLETED','CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_trip_id_bus (id, bus_id),
    KEY idx_trip_route_departure (route_id, departure_at),
    KEY idx_trip_bus_time (bus_id, departure_at),
    KEY idx_trip_driver_time (driver_employee_id, departure_at),
    CONSTRAINT fk_trip_route FOREIGN KEY (route_id) REFERENCES route(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_trip_bus FOREIGN KEY (bus_id) REFERENCES bus(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_trip_driver FOREIGN KEY (driver_employee_id) REFERENCES employee(id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT ck_trip_time CHECK (arrival_at > departure_at),
    CONSTRAINT ck_trip_price CHECK (base_price >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 07. Trang thai ghe RIENG tren tung chuyen
-- AVAILABLE -> HELD -> RESERVED -> BOOKED; BLOCKED la ghe hong
CREATE TABLE trip_seat (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    trip_id INT UNSIGNED NOT NULL,
    bus_id INT UNSIGNED NOT NULL,
    bus_seat_id INT UNSIGNED NOT NULL,
    status ENUM('AVAILABLE','HELD','RESERVED','BOOKED','BLOCKED') NOT NULL DEFAULT 'AVAILABLE',
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_trip_seat (trip_id, bus_seat_id),
    UNIQUE KEY uq_trip_seat_id_trip (id, trip_id),
    KEY idx_trip_seat_status (trip_id, status),
    KEY idx_trip_seat_trip_bus (trip_id, bus_id),
    KEY idx_trip_seat_bus_seat_bus (bus_seat_id, bus_id),
    CONSTRAINT fk_trip_seat_trip_bus FOREIGN KEY (trip_id, bus_id) REFERENCES trip(id, bus_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_trip_seat_bus_seat_bus FOREIGN KEY (bus_seat_id, bus_id) REFERENCES bus_seat(id, bus_id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 08. Chi luu hold hien tai; row het han phai duoc xoa/tai su dung
CREATE TABLE seat_hold (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    trip_seat_id INT UNSIGNED NOT NULL,
    customer_id INT UNSIGNED NULL,
    client_token VARCHAR(80) NOT NULL,
    expires_at DATETIME(3) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_hold_trip_seat (trip_seat_id),
    KEY idx_hold_expiry (expires_at),
    KEY idx_hold_customer (customer_id),
    CONSTRAINT fk_hold_seat FOREIGN KEY (trip_seat_id) REFERENCES trip_seat(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_hold_customer FOREIGN KEY (customer_id) REFERENCES customer(id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 09. Don hang: 1 don cho 1 chuyen, co the co nhieu ve
CREATE TABLE booking_order (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_code VARCHAR(40) NOT NULL,
    customer_id INT UNSIGNED NULL,
    trip_id INT UNSIGNED NOT NULL,
    contact_name VARCHAR(120) NOT NULL,
    contact_phone VARCHAR(20) NOT NULL,
    contact_email VARCHAR(191) NULL,
    total_amount DECIMAL(12,0) NOT NULL DEFAULT 0,
    status ENUM('PENDING','CONFIRMED','CANCELLED','EXPIRED','REFUNDED') NOT NULL DEFAULT 'PENDING',
    payment_deadline DATETIME(3) NULL,
    confirmed_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_booking_order_code (order_code),
    UNIQUE KEY uq_booking_order_id_trip (id, trip_id),
    KEY idx_order_customer_date (customer_id, created_at),
    KEY idx_order_trip (trip_id),
    KEY idx_order_status_deadline (status, payment_deadline),
    CONSTRAINT fk_order_customer FOREIGN KEY (customer_id) REFERENCES customer(id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_order_trip FOREIGN KEY (trip_id) REFERENCES trip(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT ck_order_amount CHECK (total_amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10. Ve theo tung hanh khach/ghe.
-- active_trip_seat_id la cot generated: chi ton tai khi ve PENDING/CONFIRMED.
-- UNIQUE bao ve 1 ghe khong the co 2 ve dang hieu luc,
-- nhung cho phep ve da CANCELLED/EXPIRED/REFUNDED duoc dat lai.
-- Hai FK kep bao dam trip cua ve == trip cua don == trip cua ghe.
CREATE TABLE booking_ticket (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_id BIGINT UNSIGNED NOT NULL,
    trip_id INT UNSIGNED NOT NULL,
    trip_seat_id INT UNSIGNED NOT NULL,
    passenger_name VARCHAR(120) NOT NULL,
    passenger_phone VARCHAR(20) NOT NULL,
    fare DECIMAL(12,0) NOT NULL,
    status ENUM('PENDING','CONFIRMED','CANCELLED','EXPIRED','REFUNDED') NOT NULL DEFAULT 'PENDING',
    active_trip_seat_id INT UNSIGNED GENERATED ALWAYS AS (
        CASE WHEN status IN ('PENDING','CONFIRMED') THEN trip_seat_id ELSE NULL END
    ) STORED,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_ticket_active_seat (active_trip_seat_id),
    KEY idx_ticket_order_trip (order_id, trip_id),
    KEY idx_ticket_seat_trip (trip_seat_id, trip_id),
    CONSTRAINT fk_ticket_order_trip FOREIGN KEY (order_id, trip_id)
        REFERENCES booking_order(id, trip_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_ticket_seat_trip FOREIGN KEY (trip_seat_id, trip_id)
        REFERENCES trip_seat(id, trip_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_ticket_fare CHECK (fare >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 11. Thanh toan; mot don co the co nhieu lan thu thanh toan
CREATE TABLE payment (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_id BIGINT UNSIGNED NOT NULL,
    payment_code VARCHAR(40) NOT NULL,
    method ENUM('MOCK','BANK_TRANSFER','MOMO','VNPAY','CASH') NOT NULL,
    amount DECIMAL(12,0) NOT NULL,
    status ENUM('PENDING','PAID','FAILED','REFUNDED') NOT NULL DEFAULT 'PENDING',
    gateway_transaction_id VARCHAR(100) NULL,
    paid_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_payment_code (payment_code),
    UNIQUE KEY uq_payment_gateway_tx (gateway_transaction_id),
    KEY idx_payment_order (order_id),
    KEY idx_payment_status (status, created_at),
    CONSTRAINT fk_payment_order FOREIGN KEY (order_id) REFERENCES booking_order(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT ck_payment_amount CHECK (amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- View: ghe HELD het han duoc dem la co the su dung, ke ca truoc don dep.
-- Khi thuc su dat, backend PHAI lock row trip_seat va xu ly hold het han.
CREATE VIEW v_trip_availability AS
SELECT
    t.id AS trip_id, r.origin, r.destination,
    t.departure_at, t.arrival_at, t.base_price, t.status AS trip_status,
    COUNT(ts.id) AS total_seats,
    COALESCE(SUM(CASE WHEN ts.status = 'BOOKED' THEN 1 ELSE 0 END), 0) AS booked_seats,
    COALESCE(SUM(CASE WHEN ts.status = 'RESERVED' THEN 1 ELSE 0 END), 0) AS reserved_seats,
    COALESCE(SUM(CASE WHEN ts.status = 'HELD' AND h.expires_at > NOW() THEN 1 ELSE 0 END), 0) AS held_seats,
    COALESCE(SUM(CASE WHEN ts.status = 'AVAILABLE'
                     OR (ts.status = 'HELD' AND (h.id IS NULL OR h.expires_at <= NOW()))
                      THEN 1 ELSE 0 END), 0) AS available_seats
FROM trip t
JOIN route r ON r.id = t.route_id
LEFT JOIN trip_seat ts ON ts.trip_id = t.id
LEFT JOIN seat_hold h ON h.trip_seat_id = ts.id
GROUP BY t.id, r.origin, r.destination,
         t.departure_at, t.arrival_at, t.base_price, t.status;

-- ====================== DU LIEU MAU =============================
INSERT INTO customer(id,full_name,email,phone,password_hash,address,status) VALUES
(1,'Nguyễn Văn An','an@example.com','0900000001','scrypt:sguDemo001Salt2026:cdf37dbda70bfb28da1bb066d57306d8fac0380d2be8dc958b013aaeafa6ab6415583af0a959659aa40e46fee3cece3788471809f4dd1e826a23a8d1b0b31471','12 Nguyễn Trãi, TP.HCM','ACTIVE'),
(2,'Trần Thị Bình','binh@example.com','0900000002','scrypt:sguDemo002Salt2026:e94e18cbbf7a3c5e267b708fa75ccfeb94a89fe63ed2a07dcaac9510db486a37cfdec3d0ffeb85f49542f85eba804df542f3efcb66f03f268cc6e58978c20739','34 Lê Lợi, TP.HCM','ACTIVE'),
(3,'Lê Minh Khang','khang@example.com','0900000003','scrypt:sguDemo003Salt2026:801fd42218819fb34c90ae88b3262b68964a1b350ab6f4fc11ad575e4a31d6b86828adab1d52d813b56a814cdb33dd4bce1604c12b6f69f559f4dad53917143f','56 Điện Biên Phủ, TP.HCM','ACTIVE'),
(4,'Phạm Thu Hà','ha@example.com','0900000004','scrypt:sguDemo004Salt2026:d3e6a0aba81345244741892db737803d90f442fdfbc317f4f2b9de1d4b6b9641181c04f553fb3f1b5c33e45ceca3d0b46aef0f031976a14d855ae1002044a113','78 Pasteur, TP.HCM','ACTIVE'),
(5,'Khách vãng lai',NULL,'0900000005',NULL,NULL,'ACTIVE');

INSERT INTO employee(id,full_name,email,phone,password_hash,role,department,driver_license,hire_date) VALUES
(1,'Nguyễn Thanh Mai','admin@sgubooking.example','0911000001','scrypt:sguDemo101Salt2026:cc1eed46b204659732887a043145105e7ed4806f2a0a736a2fea6690637ebc1793f1d1868e24cb5db5c7fff9cf54e1d7a94c12784871b800e5be3e73af2c98b0','ADMIN','Quản trị',NULL,'2026-01-10'),
(2,'Đỗ Minh Tuấn','staff@sgubooking.example','0911000002','scrypt:sguDemo102Salt2026:c9b0e0fbc6fa9449a036bf2be465d49bed242c65af83ac9a177b5ecdc7acf3c541fa28df9fca0f9430300a5be3aa970500da61df021b5183ec1f964cc73c46ea','STAFF','Điều hành',NULL,'2026-03-01'),
(3,'Phạm Quốc An','driver1@sgubooking.example','0911000003','scrypt:sguDemo103Salt2026:8c7e855363274b6ca4d23cbb9eba37fa75d49916291e0c9660bc8dd86df928f23355c03c72c37102166b679879f178eebee7f973ee8de404ef0a29da383ce592','DRIVER','Lái xe','GPLX-E-001','2026-02-15'),
(4,'Võ Văn Long','driver2@sgubooking.example','0911000004','scrypt:sguDemo104Salt2026:e5158cd514b7884bcf08fc5c6c5befd3e8eb9eb1959849025d76b7d0498ca2fd45968e1af4189c1b13d7a700e0828f410e1b4e622dace9aebdf141b6022bc859','DRIVER','Lái xe','GPLX-E-002','2026-02-20');

INSERT INTO route(id,origin,destination,distance_km,estimated_duration_min) VALUES
(1,'TP. Hồ Chí Minh','Đà Lạt',310.00,420),
(2,'Đà Lạt','TP. Hồ Chí Minh',310.00,420),
(3,'TP. Hồ Chí Minh','Nha Trang',430.00,510),
(4,'Nha Trang','TP. Hồ Chí Minh',430.00,510),
(5,'TP. Hồ Chí Minh','Vũng Tàu',100.00,180),
(6,'Vũng Tàu','TP. Hồ Chí Minh',100.00,180),
(7,'TP. Hồ Chí Minh','Hà Nội',1700.00,1800);

INSERT INTO bus(id,license_plate,bus_type,seat_capacity,brand,manufacture_year,last_maintenance_date) VALUES
(1,'51B-123.45','Limousine 22 phòng',22,'Thaco',2023,'2026-09-20'),
(2,'51B-234.56','Giường nằm 34 chỗ',34,'Hyundai',2022,'2026-09-22'),
(3,'51B-345.67','Limousine 28 chỗ',28,'Thaco',2024,'2026-09-25');

-- A = tang 1, B = tang 2. Mau ghe don gian de demo.
INSERT INTO bus_seat(bus_id,seat_number,deck,is_active) VALUES
(1,'A01',1,1),
(1,'A02',1,1),
(1,'A03',1,1),
(1,'A04',1,1),
(1,'A05',1,1),
(1,'A06',1,1),
(1,'A07',1,1),
(1,'A08',1,1),
(1,'A09',1,1),
(1,'A10',1,1),
(1,'A11',1,1),
(1,'B01',2,1),
(1,'B02',2,1),
(1,'B03',2,1),
(1,'B04',2,1),
(1,'B05',2,1),
(1,'B06',2,1),
(1,'B07',2,1),
(1,'B08',2,1),
(1,'B09',2,1),
(1,'B10',2,1),
(1,'B11',2,1),
(2,'A01',1,1),
(2,'A02',1,1),
(2,'A03',1,1),
(2,'A04',1,1),
(2,'A05',1,1),
(2,'A06',1,1),
(2,'A07',1,1),
(2,'A08',1,1),
(2,'A09',1,1),
(2,'A10',1,1),
(2,'A11',1,1),
(2,'A12',1,1),
(2,'A13',1,1),
(2,'A14',1,1),
(2,'A15',1,1),
(2,'A16',1,1),
(2,'A17',1,1),
(2,'B01',2,1),
(2,'B02',2,1),
(2,'B03',2,1),
(2,'B04',2,1),
(2,'B05',2,1),
(2,'B06',2,1),
(2,'B07',2,1),
(2,'B08',2,1),
(2,'B09',2,1),
(2,'B10',2,1),
(2,'B11',2,1),
(2,'B12',2,1),
(2,'B13',2,1),
(2,'B14',2,1),
(2,'B15',2,1),
(2,'B16',2,1),
(2,'B17',2,1),
(3,'A01',1,1),
(3,'A02',1,1),
(3,'A03',1,1),
(3,'A04',1,1),
(3,'A05',1,1),
(3,'A06',1,1),
(3,'A07',1,1),
(3,'A08',1,1),
(3,'A09',1,1),
(3,'A10',1,1),
(3,'A11',1,1),
(3,'A12',1,1),
(3,'A13',1,1),
(3,'A14',1,1),
(3,'B01',2,1),
(3,'B02',2,1),
(3,'B03',2,1),
(3,'B04',2,1),
(3,'B05',2,1),
(3,'B06',2,1),
(3,'B07',2,1),
(3,'B08',2,1),
(3,'B09',2,1),
(3,'B10',2,1),
(3,'B11',2,1),
(3,'B12',2,1),
(3,'B13',2,1),
(3,'B14',2,1);

-- Ngay khoi hanh tuong doi voi ngay IMPORT, de du lieu khong bi qua han.
-- O ca chuyen va chuyen ve, xe / tai xe khong bi trung lich.
INSERT INTO trip(id,route_id,bus_id,driver_employee_id,departure_at,arrival_at,pickup_point,dropoff_point,base_price,status) VALUES
(1,1,1,3,
 DATE_ADD(DATE_ADD(CURDATE(),INTERVAL 3 DAY),INTERVAL 21 HOUR),
 DATE_ADD(DATE_ADD(CURDATE(),INTERVAL 4 DAY),INTERVAL 4 HOUR),
 'Bến xe Miền Đông mới','Bến xe Đà Lạt',320000,'SCHEDULED'),
(2,3,2,4,
 DATE_ADD(DATE_ADD(CURDATE(),INTERVAL 3 DAY),INTERVAL 22 HOUR)+INTERVAL 30 MINUTE,
 DATE_ADD(DATE_ADD(CURDATE(),INTERVAL 4 DAY),INTERVAL 7 HOUR),
 'Bến xe Miền Đông mới','Bến xe Phía Nam Nha Trang',280000,'SCHEDULED'),
(3,2,1,3,
 DATE_ADD(DATE_ADD(CURDATE(),INTERVAL 4 DAY),INTERVAL 21 HOUR),
 DATE_ADD(DATE_ADD(CURDATE(),INTERVAL 5 DAY),INTERVAL 4 HOUR),
 'Bến xe Đà Lạt','Bến xe Miền Đông mới',320000,'SCHEDULED'),
(4,4,2,4,
 DATE_ADD(DATE_ADD(CURDATE(),INTERVAL 4 DAY),INTERVAL 22 HOUR)+INTERVAL 30 MINUTE,
 DATE_ADD(DATE_ADD(CURDATE(),INTERVAL 5 DAY),INTERVAL 7 HOUR),
 'Bến xe Phía Nam Nha Trang','Bến xe Miền Đông mới',280000,'SCHEDULED'),
(5,5,3,3,
 DATE_ADD(DATE_ADD(CURDATE(),INTERVAL 5 DAY),INTERVAL 7 HOUR)+INTERVAL 30 MINUTE,
 DATE_ADD(DATE_ADD(CURDATE(),INTERVAL 5 DAY),INTERVAL 10 HOUR)+INTERVAL 30 MINUTE,
 'Bến xe Miền Đông mới','Bến xe Vũng Tàu',160000,'SCHEDULED'),
(6,6,3,3,
 DATE_ADD(DATE_ADD(CURDATE(),INTERVAL 5 DAY),INTERVAL 14 HOUR),
 DATE_ADD(DATE_ADD(CURDATE(),INTERVAL 5 DAY),INTERVAL 17 HOUR),
 'Bến xe Vũng Tàu','Bến xe Miền Đông mới',160000,'SCHEDULED'),
(7,7,2,4,
 DATE_ADD(DATE_ADD(CURDATE(),INTERVAL 7 DAY),INTERVAL 8 HOUR),
 DATE_ADD(DATE_ADD(CURDATE(),INTERVAL 8 DAY),INTERVAL 14 HOUR),
 'Bến xe Miền Đông mới','Bến xe Nước Ngầm',900000,'SCHEDULED');

-- Tao ghe chuyen tu so do ghe xe, KHONG cho phep ghe khong thuoc xe.
INSERT INTO trip_seat(trip_id,bus_seat_id,status)
SELECT t.id, bs.id, 'AVAILABLE'
FROM trip t JOIN bus_seat bs ON bs.bus_id=t.bus_id
WHERE bs.is_active=1;

-- 5 don: da thanh toan, cho thanh toan, da huy, khach vang lai, nhieu ve
INSERT INTO booking_order
(id,order_code,customer_id,trip_id,contact_name,contact_phone,contact_email,total_amount,status,payment_deadline,confirmed_at) VALUES
(1,'SGU-DEMO-0001',1,1,'Nguyễn Văn An','0900000001','an@example.com',640000,'CONFIRMED',NULL,NOW(3)),
(2,'SGU-DEMO-0002',2,2,'Trần Thị Bình','0900000002','binh@example.com',280000,'PENDING',DATE_ADD(NOW(3),INTERVAL 20 MINUTE),NULL),
(3,'SGU-DEMO-0003',3,5,'Lê Minh Khang','0900000003','khang@example.com',160000,'CANCELLED',NULL,NULL),
(4,'SGU-DEMO-0004',NULL,4,'Nguyễn Thảo Vy','0900000099','guest@example.com',280000,'CONFIRMED',NULL,NOW(3)),
(5,'SGU-DEMO-0005',4,7,'Phạm Thu Hà','0900000004','ha@example.com',1800000,'CONFIRMED',NULL,NOW(3));

-- Ve cua don 1: 2 ghe da dat (A01, A02) tren trip 1
INSERT INTO booking_ticket(order_id,trip_id,trip_seat_id,passenger_name,passenger_phone,fare,status)
SELECT 1,1,ts.id,'Nguyễn Văn An','0900000001',320000,'CONFIRMED'
FROM trip_seat ts JOIN bus_seat bs ON ts.bus_seat_id=bs.id
WHERE ts.trip_id=1 AND bs.seat_number='A01';
INSERT INTO booking_ticket(order_id,trip_id,trip_seat_id,passenger_name,passenger_phone,fare,status)
SELECT 1,1,ts.id,'Nguyễn Minh Anh','0900000011',320000,'CONFIRMED'
FROM trip_seat ts JOIN bus_seat bs ON ts.bus_seat_id=bs.id
WHERE ts.trip_id=1 AND bs.seat_number='A02';

-- Ve pending trip 2: ghe A01 duoc RESERVED trong thoi gian cho thanh toan
INSERT INTO booking_ticket(order_id,trip_id,trip_seat_id,passenger_name,passenger_phone,fare,status)
SELECT 2,2,ts.id,'Trần Thị Bình','0900000002',280000,'PENDING'
FROM trip_seat ts JOIN bus_seat bs ON ts.bus_seat_id=bs.id
WHERE ts.trip_id=2 AND bs.seat_number='A01';

-- Ve da huy trip 5: ghe A04 duoc tra ve AVAILABLE
INSERT INTO booking_ticket(order_id,trip_id,trip_seat_id,passenger_name,passenger_phone,fare,status)
SELECT 3,5,ts.id,'Lê Minh Khang','0900000003',160000,'CANCELLED'
FROM trip_seat ts JOIN bus_seat bs ON ts.bus_seat_id=bs.id
WHERE ts.trip_id=5 AND bs.seat_number='A04';

-- Don guest (booking_order.customer_id = NULL)
INSERT INTO booking_ticket(order_id,trip_id,trip_seat_id,passenger_name,passenger_phone,fare,status)
SELECT 4,4,ts.id,'Nguyễn Thảo Vy','0900000099',280000,'CONFIRMED'
FROM trip_seat ts JOIN bus_seat bs ON ts.bus_seat_id=bs.id
WHERE ts.trip_id=4 AND bs.seat_number='B03';

-- Don 5: 2 ghe cung 1 don, chung 1 giao dich
INSERT INTO booking_ticket(order_id,trip_id,trip_seat_id,passenger_name,passenger_phone,fare,status)
SELECT 5,7,ts.id,'Phạm Thu Hà','0900000004',900000,'CONFIRMED'
FROM trip_seat ts JOIN bus_seat bs ON ts.bus_seat_id=bs.id
WHERE ts.trip_id=7 AND bs.seat_number='A03';
INSERT INTO booking_ticket(order_id,trip_id,trip_seat_id,passenger_name,passenger_phone,fare,status)
SELECT 5,7,ts.id,'Phạm Quang Minh','0900000012',900000,'CONFIRMED'
FROM trip_seat ts JOIN bus_seat bs ON ts.bus_seat_id=bs.id
WHERE ts.trip_id=7 AND bs.seat_number='B03';

-- Dong bo trang thai ghe voi ve co hieu luc
UPDATE trip_seat ts
JOIN booking_ticket bt ON bt.trip_seat_id=ts.id
SET ts.status=CASE bt.status
                WHEN 'CONFIRMED' THEN 'BOOKED'
                WHEN 'PENDING' THEN 'RESERVED'
                ELSE ts.status END
WHERE bt.status IN ('CONFIRMED','PENDING');

INSERT INTO payment(id,order_id,payment_code,method,amount,status,gateway_transaction_id,paid_at) VALUES
(1,1,'PAY-DEMO-0001','MOCK',640000,'PAID','MOCK-TXN-0001',NOW(3)),
(2,2,'PAY-DEMO-0002','MOCK',280000,'PENDING',NULL,NULL),
(3,3,'PAY-DEMO-0003','MOCK',160000,'FAILED',NULL,NULL),
(4,4,'PAY-DEMO-0004','CASH',280000,'PAID','CASH-TXN-0004',NOW(3)),
(5,5,'PAY-DEMO-0005','MOCK',1800000,'PAID','MOCK-TXN-0005',NOW(3));

-- 2 ghe dang duoc giu, het han sau 5 va 8 phut ke tu khi import
INSERT INTO seat_hold(trip_seat_id,customer_id,client_token,expires_at)
SELECT ts.id,2,'demo-session-binh-001',DATE_ADD(NOW(3),INTERVAL 5 MINUTE)
FROM trip_seat ts JOIN bus_seat bs ON bs.id=ts.bus_seat_id
WHERE ts.trip_id=1 AND bs.seat_number='A03';
INSERT INTO seat_hold(trip_seat_id,customer_id,client_token,expires_at)
SELECT ts.id,NULL,'demo-session-guest-001',DATE_ADD(NOW(3),INTERVAL 8 MINUTE)
FROM trip_seat ts JOIN bus_seat bs ON bs.id=ts.bus_seat_id
WHERE ts.trip_id=5 AND bs.seat_number='B01';
UPDATE trip_seat ts JOIN seat_hold h ON h.trip_seat_id=ts.id SET ts.status='HELD';

-- ======================= TRUY VAN DEMO ==========================
-- SELECT * FROM v_trip_availability ORDER BY departure_at;
-- SELECT t.id AS trip_id, bs.seat_number, ts.status
-- FROM trip_seat ts JOIN trip t ON ts.trip_id=t.id
-- JOIN bus_seat bs ON bs.id=ts.bus_seat_id
-- WHERE t.id=1 ORDER BY bs.seat_number;
-- SELECT bo.order_code, bo.status, bt.passenger_name, bs.seat_number
-- FROM booking_order bo JOIN booking_ticket bt ON bt.order_id=bo.id
-- JOIN trip_seat ts ON ts.id=bt.trip_seat_id
-- JOIN bus_seat bs ON bs.id=ts.bus_seat_id
-- ORDER BY bo.id,bt.id;
-- SELECT order_code, status, total_amount FROM booking_order ORDER BY id;
-- SELECT * FROM payment ORDER BY id;
-- ================================================================
