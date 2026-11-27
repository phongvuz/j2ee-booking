package com.nhom.booking.entities;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Một ghế của một đơn. Database có UNIQUE (trip_id, seat_code)
 * nên không thể có 2 đơn cùng giữ một ghế trên cùng một chuyến.
 */
@Entity
@Table(name = "order_seats")
@Getter
@Setter
@NoArgsConstructor
public class OrderSeat {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    @Column(name = "trip_id", nullable = false)
    private Long tripId;

    @Column(name = "seat_code", nullable = false, length = 10)
    private String seatCode;
}
