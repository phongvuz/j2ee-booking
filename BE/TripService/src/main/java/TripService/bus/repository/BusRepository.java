package TripService.bus.repository;

import TripService.bus.entity.Bus;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BusRepository extends JpaRepository<Bus, Long> {

    boolean existsByBusCode(String busCode);
    boolean existsByPlateNumber(String plateNumber);
    boolean existsByBusCodeAndIdNot(String busCode, Long id);
    boolean existsByPlateNumberAndIdNot(String plateNumber, Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select b from Bus b where b.id = :id")
    Optional<Bus> findByIdForUpdate(@Param("id") Long id);
}
