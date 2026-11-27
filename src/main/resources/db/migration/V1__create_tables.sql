-- ============================================================
-- HỆ THỐNG ĐẶT VÉ XE KHÁCH (FUTABUS CLONE - J2EE)
-- Database: PostgreSQL
-- ============================================================

-- 1. Bảng USERS (Quản lý tài khoản & phân quyền ADMIN / CLIENT)
CREATE TABLE IF NOT EXISTS users (
    id              BIGSERIAL PRIMARY KEY,
    username        VARCHAR(100) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(20)  NOT NULL DEFAULT 'CLIENT'
                    CHECK (role IN ('ADMIN', 'CLIENT'))
);

-- 2. Bảng BUSES (Quản lý xe)
CREATE TABLE IF NOT EXISTS buses (
    id              BIGSERIAL PRIMARY KEY,
    bus_code        VARCHAR(20)  NOT NULL UNIQUE,   -- VD: BUS-001
    plate_number    VARCHAR(20)  NOT NULL UNIQUE,   -- VD: 51B-123.45
    type            VARCHAR(100) NOT NULL,          -- VD: Limousine 22 phòng
    seat_count      INT          NOT NULL CHECK (seat_count > 0),
    status          VARCHAR(30)  NOT NULL DEFAULT 'ACTIVE'
                    CHECK (status IN ('ACTIVE', 'MAINTENANCE', 'INACTIVE'))
);

-- 3. Bảng TRIPS (Quản lý chuyến xe - Many-to-One tới BUSES)
CREATE TABLE IF NOT EXISTS trips (
    id              BIGSERIAL PRIMARY KEY,
    trip_code       VARCHAR(20)    NOT NULL UNIQUE, -- VD: VN01
    bus_id          BIGINT         NOT NULL,
    departure       VARCHAR(100)   NOT NULL,        -- VD: SGN hoặc Hồ Chí Minh
    destination     VARCHAR(100)   NOT NULL,        -- VD: DLT hoặc Đà Lạt
    departure_date  DATE           NOT NULL,
    departure_time  TIME           NOT NULL,
    price           NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    empty_seats     INT            NOT NULL CHECK (empty_seats >= 0),

    CONSTRAINT fk_trips_bus
        FOREIGN KEY (bus_id) REFERENCES buses(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

-- 4. Bảng ORDERS (Quản lý đơn vé - Many-to-One tới TRIPS và USERS)
--    Chỉ người dùng đã đăng nhập mới được đặt vé => user_id NOT NULL.
--    Danh sách ghế của đơn nằm ở bảng ORDER_SEATS.
CREATE TABLE IF NOT EXISTS orders (
    id              BIGSERIAL PRIMARY KEY,
    pnr_code        VARCHAR(30)    NOT NULL UNIQUE, -- VD: NHAXE-1A2B3C (UNIQUE đã tự tạo index)
    customer_name   VARCHAR(150)   NOT NULL,
    customer_phone  VARCHAR(20)    NOT NULL,
    trip_id         BIGINT         NOT NULL,
    user_id         BIGINT         NOT NULL,
    total_price     NUMERIC(12, 2) NOT NULL CHECK (total_price >= 0),
    status          VARCHAR(30)    NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING', 'PAID', 'CANCELLED')),
    booking_date    TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_orders_trip
        FOREIGN KEY (trip_id) REFERENCES trips(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT fk_orders_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

-- 4b. Bảng ORDER_SEATS (Ghế của từng đơn)
--     UNIQUE (trip_id, seat_code): database tự chặn đặt trùng ghế trên cùng một chuyến.
--     Khi hủy đơn: xóa các dòng của đơn đó để trả ghế lại.
CREATE TABLE IF NOT EXISTS order_seats (
    id              BIGSERIAL PRIMARY KEY,
    order_id        BIGINT      NOT NULL,
    trip_id         BIGINT      NOT NULL,
    seat_code       VARCHAR(10) NOT NULL,           -- VD: 1A1

    CONSTRAINT fk_os_order
        FOREIGN KEY (order_id) REFERENCES orders(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_os_trip
        FOREIGN KEY (trip_id) REFERENCES trips(id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_trip_seat UNIQUE (trip_id, seat_code)
);

-- 5. Bảng EMPLOYEES (Quản lý nhân viên)
CREATE TABLE IF NOT EXISTS employees (
    id              BIGSERIAL PRIMARY KEY,
    emp_code        VARCHAR(20)  NOT NULL UNIQUE,   -- VD: EMP-001
    name            VARCHAR(150) NOT NULL,
    role            VARCHAR(50)  NOT NULL,          -- Tài xế, Phụ xe, Văn phòng, Quản lý
    phone           VARCHAR(20)  NOT NULL UNIQUE,
    status          VARCHAR(30)  NOT NULL DEFAULT 'WORKING'
                    CHECK (status IN ('WORKING', 'ON_LEAVE', 'RESIGNED'))
);

-- 6. Bảng BUS_EMPLOYEES (Tùy chọn theo ERD: Quan hệ Many-to-Many giữa BUSES và EMPLOYEES)
CREATE TABLE IF NOT EXISTS bus_employees (
    bus_id          BIGINT NOT NULL,
    employee_id     BIGINT NOT NULL,

    PRIMARY KEY (bus_id, employee_id),

    CONSTRAINT fk_be_bus
        FOREIGN KEY (bus_id) REFERENCES buses(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_be_employee
        FOREIGN KEY (employee_id) REFERENCES employees(id)
        ON DELETE CASCADE
);

-- ============================================================
-- INDEX TỐI ƯU TRUY VẤN (Tìm kiếm chuyến, Tra cứu SĐT, Dashboard)
-- ============================================================
CREATE INDEX idx_trips_search ON trips (departure, destination, departure_date);
CREATE INDEX idx_orders_phone ON orders (customer_phone);
CREATE INDEX idx_orders_trip ON orders (trip_id);
CREATE INDEX idx_orders_user ON orders (user_id);
CREATE INDEX idx_order_seats_order ON order_seats (order_id);
