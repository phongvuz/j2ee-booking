package com.booking.employee.repository;

import com.booking.employee.model.Employee;
import com.booking.employee.model.EmployeeStatus;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface EmployeeRepository extends JpaRepository<Employee, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<Employee> findOneById(Long id);

    @Query("select e.status as status, count(e) as total from Employee e group by e.status")
    List<StatusCount> countByWorkStatus();

    interface StatusCount {
        EmployeeStatus getStatus();

        long getTotal();
    }
}
