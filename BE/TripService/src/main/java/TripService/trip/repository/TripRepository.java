package TripService.trip.repository;

import TripService.trip.entity.Trip;
import jakarta.persistence.LockModeType;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TripRepository extends JpaRepository<Trip, Long>, JpaSpecificationExecutor<Trip> {

    boolean existsByTripCode(String tripCode);
    boolean existsByTripCodeAndIdNot(String tripCode, Long id);
    boolean existsByBusId(Long busId);
    boolean existsByBusIdAndDepartureDateAndDepartureTime(Long busId, LocalDate date, LocalTime time);
    boolean existsByBusIdAndDepartureDateAndDepartureTimeAndIdNot(
            Long busId, LocalDate date, LocalTime time, Long id);

    @Override
    @EntityGraph(attributePaths = "bus")
    Page<Trip> findAll(Specification<Trip> specification, Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from Trip t where t.id = :id")
    Optional<Trip> findByIdForUpdate(@Param("id") Long id);
}
