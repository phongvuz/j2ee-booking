package com.nhom.booking.repositories;

import com.nhom.booking.entities.Trip;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

/**
 * TẠM THỜI - bản tối giản của module Order.
 * Khi người phụ trách Trips push TripRepository của họ, hãy gộp: giữ lại
 * phương thức findByIdForUpdate này trong file của họ rồi xóa file tạm.
 */
public interface TripRepository extends JpaRepository<Trip, Long> {

    /** Khóa dòng chuyến để các lần đặt/hủy vé cùng lúc được xử lý lần lượt. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from Trip t where t.id = :id")
    Optional<Trip> findByIdForUpdate(@Param("id") Long id);
}
