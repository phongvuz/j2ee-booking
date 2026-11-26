CREATE TABLE IF NOT EXISTS buses (
    id BIGSERIAL PRIMARY KEY,
    bus_code VARCHAR(20) NOT NULL UNIQUE,
    plate_number VARCHAR(20) NOT NULL UNIQUE,
    type VARCHAR(100) NOT NULL,
    seat_count INT NOT NULL CHECK (seat_count > 0),
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'MAINTENANCE', 'INACTIVE'))
);

CREATE TABLE IF NOT EXISTS trips (
    id BIGSERIAL PRIMARY KEY,
    trip_code VARCHAR(20) NOT NULL UNIQUE,
    bus_id BIGINT NOT NULL,
    departure VARCHAR(100) NOT NULL,
    destination VARCHAR(100) NOT NULL,
    departure_date DATE NOT NULL,
    departure_time TIME NOT NULL,
    price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    empty_seats INT NOT NULL CHECK (empty_seats >= 0),
    CONSTRAINT fk_trips_bus FOREIGN KEY (bus_id) REFERENCES buses(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_trips_search
    ON trips (departure, destination, departure_date);
