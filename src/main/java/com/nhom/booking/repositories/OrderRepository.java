package com.nhom.booking.repositories;

import com.nhom.booking.entities.Order;
import com.nhom.booking.entities.OrderStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface OrderRepository extends JpaRepository<Order, Long>, JpaSpecificationExecutor<Order> {

    // Nạp luôn trip và user trong 1 câu query để tránh N+1
    @Override
    @EntityGraph(attributePaths = {"trip", "user"})
    Optional<Order> findById(Long id);

    @Override
    @EntityGraph(attributePaths = {"trip", "user"})
    Page<Order> findAll(Specification<Order> spec, Pageable pageable);

    /** Tra cứu vé: phải khớp cả PNR (không phân biệt hoa/thường) và số điện thoại. */
    @EntityGraph(attributePaths = {"trip", "user"})
    Optional<Order> findByPnrCodeIgnoreCaseAndCustomerPhone(String pnrCode, String customerPhone);

    /** Khóa dòng đơn khi sửa / thanh toán / hủy để hai thao tác cùng lúc không đè nhau. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from com.nhom.booking.entities.Order o where o.id = :id")
    Optional<Order> findByIdForUpdate(@Param("id") Long id);

    boolean existsByPnrCode(String pnrCode);

    /** Id các đơn có trạng thái và thời điểm đặt trước mốc cho trước (dùng cho việc tự hủy đơn quá hạn). */
    @Query("select o.id from com.nhom.booking.entities.Order o "
            + "where o.status = :status and o.bookingDate < :cutoff")
    List<Long> findIdsByStatusAndBookingDateBefore(@Param("status") OrderStatus status,
                                                   @Param("cutoff") LocalDateTime cutoff);
}
