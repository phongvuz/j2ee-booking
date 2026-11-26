package com.booking.employee.repository;

import com.booking.employee.model.Employee;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

public interface EmployeeRepository extends JpaRepository<Employee, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<Employee> findOneById(Long id);
}
