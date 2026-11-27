package com.nhom.booking.repositories;

import com.nhom.booking.entities.OrderSeat;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface OrderSeatRepository extends JpaRepository<OrderSeat, Long> {

    /** Tất cả ghế đã có người đặt (đơn PENDING hoặc PAID) của một chuyến. Đơn đã hủy không còn dòng ghế. */
    @Query("select s.seatCode from OrderSeat s where s.tripId = :tripId order by s.seatCode")
    List<String> findSeatCodesByTripId(@Param("tripId") Long tripId);

    /** Trong các ghế được hỏi, ghế nào đã có người đặt trên chuyến này. */
    @Query("select s.seatCode from OrderSeat s where s.tripId = :tripId and s.seatCode in :codes")
    List<String> findTakenSeatCodes(@Param("tripId") Long tripId, @Param("codes") Collection<String> codes);
}
